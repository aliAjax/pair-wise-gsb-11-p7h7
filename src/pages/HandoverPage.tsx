// 页面：交接班（复检不合格区域不能交班；班长确认待办 → 接班人签收；历史单可查）

import { useMemo, useState } from "react";
import { Alert, Button, Card, Col, Empty, Input, Row, Space, Steps, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { AnomalyRecord, Handover, HandoverPendingItem } from "../data/types";
import { useStore } from "../store";
import { activeHandover, blockedAreas, isOverdue, lastRecheckFailed, pendingRecords } from "../domain/rules";

const fmt = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString("zh-CN", { hour12: false }) : "—";

const pendingColumns: ColumnsType<AnomalyRecord> = [
  { title: "单号", dataIndex: "code", width: 140 },
  { title: "设备", dataIndex: "equipment" },
  { title: "区域", dataIndex: "area", width: 80 },
  {
    title: "状态",
    dataIndex: "status",
    width: 120,
    render: (_, r) => (
      <Space size={4} wrap>
        <Tag color={r.status === "待复检" ? "blue" : "orange"}>{r.status}</Tag>
        {lastRecheckFailed(r) && <Tag color="red">复检不合格</Tag>}
      </Space>
    ),
  },
  { title: "责任人", dataIndex: "owner", width: 80 },
  {
    title: "期限",
    dataIndex: "deadline",
    width: 130,
    render: (_, r) => (
      <Space size={4}>
        <span>{r.deadline}</span>
        {isOverdue(r) && <Tag color="red">已逾期</Tag>}
      </Space>
    ),
  },
];

const snapshotColumns: ColumnsType<HandoverPendingItem> = [
  { title: "单号", dataIndex: "code", width: 140 },
  { title: "设备", dataIndex: "equipment" },
  { title: "区域", dataIndex: "area", width: 80 },
  { title: "状态", dataIndex: "status", width: 80, render: (v: string) => <Tag>{v}</Tag> },
  { title: "责任人", dataIndex: "owner", width: 80 },
  { title: "期限", dataIndex: "deadline", width: 110 },
];

const historyColumns: ColumnsType<Handover> = [
  { title: "单号", dataIndex: "code", width: 140 },
  { title: "班次", dataIndex: "shiftName" },
  { title: "待办", width: 60, render: (_, h) => h.pending.length },
  { title: "班长", dataIndex: "leader", width: 70 },
  { title: "接班人", dataIndex: "successor", width: 80 },
  { title: "签收时间", width: 150, render: (_, h) => fmt(h.signedAt) },
];

export default function HandoverPage() {
  const records = useStore((s) => s.records);
  const handovers = useStore((s) => s.handovers);
  const createHandover = useStore((s) => s.createHandover);
  const confirmHandover = useStore((s) => s.confirmHandover);
  const signHandover = useStore((s) => s.signHandover);

  const [shiftName, setShiftName] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [leader, setLeader] = useState("");
  const [successor, setSuccessor] = useState("");
  const [messageApi, contextHolder] = message.useMessage();

  const blocked = useMemo(() => blockedAreas(records), [records]);
  const pending = useMemo(() => pendingRecords(records), [records]);
  const active = useMemo(() => activeHandover(handovers), [handovers]);
  const history = useMemo(() => handovers.filter((h) => h.status === "已签收"), [handovers]);

  const act = (result: { ok: boolean; message: string }) => {
    if (result.ok) messageApi.success(result.message || "操作成功");
    else messageApi.error(result.message);
    return result.ok;
  };

  const stepCurrent = !active ? 0 : active.status === "待班长确认" ? 1 : active.status === "待签收" ? 2 : 3;

  return (
    <Row gutter={[16, 16]}>
      {contextHolder}
      <Col xs={24} lg={14}>
        <Card title={`当前待办（${pending.length} 项）`}>
          <Table<AnomalyRecord>
            rowKey="id"
            size="small"
            columns={pendingColumns}
            dataSource={pending}
            pagination={false}
            locale={{ emptyText: "暂无待办，可以交班" }}
            rowClassName={(r) => (lastRecheckFailed(r) ? "row-blocked" : "")}
          />
        </Card>

        <Card title="生成交接班单" style={{ marginTop: 16 }}>
          {blocked.length > 0 ? (
            <Alert
              type="error"
              showIcon
              message="复检未合格，不能交班"
              description={`涉及区域：${blocked.join("、")}。请先完成整改并复检合格，再生成交接班单。`}
            />
          ) : active ? (
            <Alert
              type="info"
              showIcon
              message={`交接单 ${active.code} 正在流转（${active.status}），签收后才能生成下一单。`}
            />
          ) : (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Input
                placeholder="班次名称，如：早班→中班"
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
              />
              <Input placeholder="交班人" value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} />
              <Button
                type="primary"
                onClick={() => {
                  const done = act(createHandover(shiftName, createdBy));
                  if (done) {
                    setShiftName("");
                    setCreatedBy("");
                  }
                }}
              >
                生成交接单（待办 {pending.length} 项）
              </Button>
            </Space>
          )}
        </Card>
      </Col>

      <Col xs={24} lg={10}>
        <Card title={active ? `交接单 ${active.code}` : "交接单"}>
          {!active ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无进行中的交接单" />
          ) : (
            <>
              <Steps
                direction="vertical"
                size="small"
                current={stepCurrent}
                items={[
                  {
                    title: "生成交接单",
                    description: `${active.shiftName} · ${active.createdBy} · ${fmt(active.createdAt)}`,
                  },
                  {
                    title: "班长确认待办",
                    description: active.leader ? `${active.leader} · ${fmt(active.confirmedAt)}` : "待确认",
                  },
                  {
                    title: "接班人签收",
                    description: active.successor ? `${active.successor} · ${fmt(active.signedAt)}` : "待签收",
                  },
                ]}
              />
              <h4>交接待办（{active.pending.length} 项，快照已冻结）</h4>
              <Table<HandoverPendingItem>
                rowKey="recordId"
                size="small"
                columns={snapshotColumns}
                dataSource={active.pending}
                pagination={false}
                locale={{ emptyText: "本班无待办" }}
              />
              {active.status === "待班长确认" && (
                <div className="handover-actions">
                  <Input
                    placeholder="班长姓名"
                    style={{ width: 150 }}
                    value={leader}
                    onChange={(e) => setLeader(e.target.value)}
                  />
                  <Button
                    type="primary"
                    onClick={() => {
                      const done = act(confirmHandover(active.id, leader));
                      if (done) setLeader("");
                    }}
                  >
                    确认待办
                  </Button>
                </div>
              )}
              {active.status === "待签收" && (
                <div className="handover-actions">
                  <Input
                    placeholder="接班人姓名"
                    style={{ width: 150 }}
                    value={successor}
                    onChange={(e) => setSuccessor(e.target.value)}
                  />
                  <Button
                    type="primary"
                    onClick={() => {
                      const done = act(signHandover(active.id, successor));
                      if (done) setSuccessor("");
                    }}
                  >
                    签收
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>

        <Card title="历史交接" style={{ marginTop: 16 }}>
          <Table<Handover>
            rowKey="id"
            size="small"
            columns={historyColumns}
            dataSource={history}
            pagination={false}
            locale={{ emptyText: "暂无历史交接" }}
          />
        </Card>
      </Col>
    </Row>
  );
}
