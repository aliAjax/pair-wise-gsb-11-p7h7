// 页面：整改台账（按设备、区域、状态查询；整改/复检/补写操作；展开看前后记录与留痕）

import { useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  Modal,
  Radio,
  Select,
  Space,
  Table,
  Tag,
  Timeline,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { AREAS, RECORD_STATUSES, type AnomalyRecord, type RecordStatus } from "../data/types";
import { useStore } from "../store";
import {
  equipmentRectificationTotal,
  isOverdue,
  lastRecheckFailed,
  occurrenceIndex,
  rectificationCount,
} from "../domain/rules";

const STATUS_COLORS: Record<RecordStatus, string> = {
  待整改: "orange",
  待复检: "blue",
  已完成: "green",
};

const STATUS_FILTERS = ["全部", ...RECORD_STATUSES, "复检不合格"] as const;

const fmt = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString("zh-CN", { hour12: false }) : "—";

type ModalState =
  | { kind: "rectify"; record: AnomalyRecord }
  | { kind: "recheck"; record: AnomalyRecord }
  | { kind: "amend"; record: AnomalyRecord }
  | null;

function RecordDetail({ record, records }: { record: AnomalyRecord; records: AnomalyRecord[] }) {
  const prev = record.prevRecordId ? records.find((r) => r.id === record.prevRecordId) : undefined;
  const next = records.find((r) => r.prevRecordId === record.id);

  return (
    <div className="detail">
      <Descriptions
        size="small"
        column={2}
        bordered
        items={[
          { key: "desc", label: "现场说明", span: 2, children: record.description },
          { key: "reporter", label: "登记人", children: record.reporter },
          { key: "createdAt", label: "登记时间", children: fmt(record.createdAt) },
          { key: "result", label: "整改结论", children: record.resultNote || "—" },
          { key: "frozenAt", label: "冻结时间", children: fmt(record.frozenAt) },
          {
            key: "prev",
            label: "上一条异常",
            children: prev ? `${prev.code}（${prev.status}）` : "首次异常",
          },
          {
            key: "next",
            label: "下一条异常",
            children: next ? `${next.code}（${next.status}）` : "—",
          },
        ]}
      />

      <h4>整改与复检（{record.entries.length} 次）</h4>
      {record.entries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未提交整改" />
      ) : (
        <Timeline
          items={record.entries.flatMap((entry, index) => [
            {
              color: "blue",
              children: `第${index + 1}次整改：${entry.summary}（${entry.by}，${fmt(entry.at)}）`,
            },
            entry.recheck
              ? {
                  color: entry.recheck.passed ? "green" : "red",
                  children: `复检${entry.recheck.passed ? "合格" : "不合格"}：${entry.recheck.note || "无说明"}（${entry.recheck.by}，${fmt(entry.recheck.at)}）`,
                }
              : { color: "gray", children: "待复检" },
          ])}
        />
      )}

      {record.amendments.length > 0 && (
        <>
          <h4>补写留痕（记录已冻结）</h4>
          <Timeline
            items={record.amendments.map((a) => ({
              color: "orange",
              children: (
                <div>
                  <div>
                    {a.by} 于 {fmt(a.at)} 补写，原因：{a.reason}
                  </div>
                  <div className="muted">改前：{a.before || "（空）"}</div>
                  <div>改后：{a.after}</div>
                </div>
              ),
            }))}
          />
        </>
      )}
    </div>
  );
}

export default function BoardPage() {
  const records = useStore((s) => s.records);
  const submitRectification = useStore((s) => s.submitRectification);
  const recheckRectification = useStore((s) => s.recheckRectification);
  const amendResult = useStore((s) => s.amendResult);

  const [equipmentFilter, setEquipmentFilter] = useState("全部");
  const [areaFilter, setAreaFilter] = useState("全部");
  const [statusFilter, setStatusFilter] = useState<string>("全部");

  const [modal, setModal] = useState<ModalState>(null);
  const [by, setBy] = useState("");
  const [text, setText] = useState("");
  const [reason, setReason] = useState("");
  const [passed, setPassed] = useState(true);
  const [messageApi, contextHolder] = message.useMessage();

  const equipments = useMemo(() => [...new Set(records.map((r) => r.equipment))], [records]);

  const filtered = useMemo(
    () =>
      records.filter((r) => {
        if (equipmentFilter !== "全部" && r.equipment !== equipmentFilter) return false;
        if (areaFilter !== "全部" && r.area !== areaFilter) return false;
        if (statusFilter === "复检不合格") return lastRecheckFailed(r);
        if (statusFilter !== "全部" && r.status !== statusFilter) return false;
        return true;
      }),
    [records, equipmentFilter, areaFilter, statusFilter]
  );

  const openModal = (next: Exclude<ModalState, null>) => {
    setBy(next.kind === "rectify" ? next.record.owner : "");
    setText("");
    setReason("");
    setPassed(true);
    setModal(next);
  };

  const submitModal = () => {
    if (!modal) return;
    let result;
    if (modal.kind === "rectify") result = submitRectification(modal.record.id, by, text);
    else if (modal.kind === "recheck") result = recheckRectification(modal.record.id, passed, by, text);
    else result = amendResult(modal.record.id, by, reason, text);

    if (result.ok) {
      messageApi.success("已保存");
      setModal(null);
    } else {
      messageApi.error(result.message);
    }
  };

  const modalTitle = !modal
    ? ""
    : modal.kind === "rectify"
      ? `提交整改（${modal.record.code}）`
      : modal.kind === "recheck"
        ? `复检判定（${modal.record.code}）`
        : `补写结果（${modal.record.code}）`;

  const columns: ColumnsType<AnomalyRecord> = [
    { title: "单号", dataIndex: "code", width: 150 },
    {
      title: "设备",
      dataIndex: "equipment",
      render: (_, r) => {
        const occurrence = occurrenceIndex(records, r);
        return (
          <Space size={4} wrap>
            <span>{r.equipment}</span>
            {occurrence > 1 && <Tag color="purple">第{occurrence}次异常</Tag>}
          </Space>
        );
      },
    },
    { title: "区域", dataIndex: "area", width: 90 },
    { title: "责任人", dataIndex: "owner", width: 90 },
    {
      title: "期限",
      dataIndex: "deadline",
      width: 140,
      render: (_, r) => (
        <Space size={4}>
          <span>{r.deadline}</span>
          {isOverdue(r) && <Tag color="red">已逾期</Tag>}
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 130,
      render: (_, r) => (
        <Space size={4} wrap>
          <Tag color={STATUS_COLORS[r.status]}>{r.status}</Tag>
          {lastRecheckFailed(r) && <Tag color="red">复检不合格</Tag>}
        </Space>
      ),
    },
    {
      title: "整改次数",
      width: 130,
      render: (_, r) => (
        <span>
          {rectificationCount(r)} 次{" "}
          <span className="muted">(设备累计 {equipmentRectificationTotal(records, r.equipment)})</span>
        </span>
      ),
    },
    {
      title: "操作",
      width: 130,
      render: (_, r) => (
        <>
          {r.status === "待整改" && (
            <Button size="small" type="primary" onClick={() => openModal({ kind: "rectify", record: r })}>
              提交整改
            </Button>
          )}
          {r.status === "待复检" && (
            <Button size="small" type="primary" onClick={() => openModal({ kind: "recheck", record: r })}>
              复检
            </Button>
          )}
          {r.status === "已完成" && (
            <Button size="small" onClick={() => openModal({ kind: "amend", record: r })}>
              补写结果
            </Button>
          )}
        </>
      ),
    },
  ];

  return (
    <Card title="整改台账">
      {contextHolder}
      <div className="filter-bar">
        <Select
          value={equipmentFilter}
          onChange={setEquipmentFilter}
          style={{ minWidth: 170 }}
          options={[{ value: "全部", label: "全部设备" }, ...equipments.map((e) => ({ value: e, label: e }))]}
        />
        <Select
          value={areaFilter}
          onChange={setAreaFilter}
          style={{ minWidth: 130 }}
          options={[{ value: "全部", label: "全部区域" }, ...AREAS.map((a) => ({ value: a, label: a }))]}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ minWidth: 130 }}
          options={STATUS_FILTERS.map((s) => ({ value: s, label: s === "全部" ? "全部状态" : s }))}
        />
      </div>

      <Table<AnomalyRecord>
        rowKey="id"
        size="middle"
        columns={columns}
        dataSource={filtered}
        pagination={{ pageSize: 8 }}
        locale={{ emptyText: "暂无匹配记录" }}
        expandable={{ expandedRowRender: (r) => <RecordDetail record={r} records={records} /> }}
      />

      <Modal
        title={modalTitle}
        open={modal !== null}
        onOk={submitModal}
        onCancel={() => setModal(null)}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        {modal && modal.kind === "rectify" && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <div className="muted">
              责任人：{modal.record.owner}　期限：{modal.record.deadline}
            </div>
            <Input placeholder="整改人" value={by} onChange={(e) => setBy(e.target.value)} />
            <Input.TextArea
              rows={3}
              placeholder="整改说明（做了什么、更换了什么）"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Space>
        )}
        {modal && modal.kind === "recheck" && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Radio.Group value={passed} onChange={(e) => setPassed(e.target.value as boolean)}>
              <Radio value={true}>复检合格（完成并冻结）</Radio>
              <Radio value={false}>复检不合格（退回整改，所在区域不能交班）</Radio>
            </Radio.Group>
            <Input placeholder="复检人" value={by} onChange={(e) => setBy(e.target.value)} />
            <Input.TextArea
              rows={2}
              placeholder="复检说明"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Space>
        )}
        {modal && modal.kind === "amend" && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Alert type="info" showIcon message="记录已完成并冻结，补写将保留原因与改前内容" />
            <span className="muted">改前内容</span>
            <Input.TextArea rows={2} value={modal.record.resultNote} disabled />
            <Input placeholder="补写人" value={by} onChange={(e) => setBy(e.target.value)} />
            <Input placeholder="补写原因（必填）" value={reason} onChange={(e) => setReason(e.target.value)} />
            <Input.TextArea
              rows={3}
              placeholder="补写后的整改结论"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </Space>
        )}
      </Modal>
    </Card>
  );
}
