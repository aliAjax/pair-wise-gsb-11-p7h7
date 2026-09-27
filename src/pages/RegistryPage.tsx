import { useMemo, useState } from "react";
import {
  App as AntApp,
  Button,
  Card,
  Col,
  Input,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AREAS,
  type Issue,
  type IssueStatus,
  ISSUE_STATUS_META,
  OPEN_STATUSES,
} from "../data/types";
import { useAppStore } from "../store/useAppStore";
import { isOverdue, metrics, queryIssues } from "../rules/engine";
import { deadlineText } from "../utils/format";
import RegisterIssueModal from "./components/RegisterIssueModal";
import IssueDrawer from "./components/IssueDrawer";

const { Text } = Typography;

const FILTER_KEY = "gas-station-registry-filters";

function loadFilters(): {
  area: string;
  status: string;
  deviceId: string;
  keyword: string;
} {
  try {
    return {
      area: "all",
      status: "all",
      deviceId: "all",
      keyword: "",
      ...JSON.parse(localStorage.getItem(FILTER_KEY) ?? "{}"),
    };
  } catch {
    return { area: "all", status: "all", deviceId: "all", keyword: "" };
  }
}

export default function RegistryPage() {
  const { data, reset } = useAppStore();
  const { message, modal } = AntApp.useApp();
  const [registerOpen, setRegisterOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filters, setFilters] = useState(loadFilters);

  function patchFilter(patch: Partial<typeof filters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    localStorage.setItem(FILTER_KEY, JSON.stringify(next));
  }

  const list = useMemo(
    () =>
      queryIssues(data, {
        area: filters.area === "all" ? "all" : (filters.area as Issue["area"]),
        status:
          filters.status === "all"
            ? "all"
            : (filters.status as IssueStatus),
        deviceId: filters.deviceId === "all" ? undefined : filters.deviceId,
        keyword: filters.keyword,
      }),
    [data, filters]
  );

  const stats = useMemo(() => metrics(data), [data]);

  const columns: ColumnsType<Issue> = [
    {
      title: "设备 / 区域",
      dataIndex: "deviceName",
      width: 200,
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.deviceName}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.area} · 第 {r.occurrenceNo} 次异常
          </Text>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      filters: [],
      render: (_, r) => (
        <Tag color={ISSUE_STATUS_META[r.status].color}>
          {ISSUE_STATUS_META[r.status].label}
        </Tag>
      ),
    },
    {
      title: "责任人",
      dataIndex: "owner",
      width: 90,
    },
    {
      title: "期限",
      dataIndex: "deadline",
      width: 170,
      sorter: (a, b) => a.deadline.localeCompare(b.deadline),
      render: (_, r) => {
        const open = OPEN_STATUSES.includes(r.status);
        const overdue = isOverdue(r);
        return (
          <Text type={overdue ? "danger" : open ? "warning" : undefined}>
            {deadlineText(r.deadline, open)}
          </Text>
        );
      },
    },
    {
      title: "现场说明",
      dataIndex: "sceneNote",
      ellipsis: { showTitle: false },
      render: (v: string) => (
        <Tooltip title={v}>
          <span>{v}</span>
        </Tooltip>
      ),
    },
    {
      title: "整改/复检",
      width: 120,
      render: (_, r) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          整改 {r.rectifications.length} 次
          <br />
          复检 {r.rechecks.length} 次
        </Text>
      ),
    },
    {
      title: "操作",
      width: 90,
      fixed: "right",
      render: (_, r) => (
        <Button type="link" size="small" onClick={() => setActiveId(r.id)}>
          {r.status === "done" ? "查看/补写" : "处理"}
        </Button>
      ),
    },
  ];

  function confirmReset() {
    modal.confirm({
      title: "恢复演示数据？",
      content: "将清空本地全部整改、复检与交班记录，恢复为初始种子数据。",
      okText: "恢复",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: () => {
        reset();
        message.success("已恢复演示数据");
      },
    });
  }

  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="未关闭异常" value={stats.open} valueStyle={{ color: "#d48806" }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="复检未过（拦交班）" value={stats.rework} valueStyle={{ color: "#cf1322" }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="待复检" value={stats.recheck} valueStyle={{ color: "#0958d9" }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="已逾期" value={stats.overdue} valueStyle={{ color: stats.overdue ? "#cf1322" : undefined }} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
          <Space wrap>
            <Select
              style={{ width: 130 }}
              value={filters.area}
              onChange={(v) => patchFilter({ area: v, deviceId: "all" })}
              options={[
                { value: "all", label: "全部区域" },
                ...AREAS.map((a) => ({ value: a, label: a })),
              ]}
            />
            <Select
              style={{ width: 150 }}
              value={filters.deviceId}
              onChange={(v) => patchFilter({ deviceId: v })}
              showSearch
              optionFilterProp="label"
              options={[
                { value: "all", label: "全部设备" },
                ...data.devices
                  .filter((d) => filters.area === "all" || d.area === filters.area)
                  .map((d) => ({
                    value: d.id,
                    label: `${d.name}${d.occurrenceCount ? `（异常${d.occurrenceCount}次）` : ""}`,
                  })),
              ]}
            />
            <Select
              style={{ width: 140 }}
              value={filters.status}
              onChange={(v) => patchFilter({ status: v })}
              options={[
                { value: "all", label: "全部状态" },
                ...(Object.keys(ISSUE_STATUS_META) as IssueStatus[]).map((s) => ({
                  value: s,
                  label: ISSUE_STATUS_META[s].label,
                })),
              ]}
            />
            <Input.Search
              style={{ width: 220 }}
              placeholder="搜设备/责任人/现场说明"
              allowClear
              value={filters.keyword}
              onChange={(e) => patchFilter({ keyword: e.target.value })}
            />
          </Space>
          <Space>
            <Button onClick={confirmReset}>恢复演示数据</Button>
            <Button type="primary" onClick={() => setRegisterOpen(true)}>
              登记异常
            </Button>
          </Space>
        </Space>

        <Table<Issue>
          rowKey="id"
          columns={columns}
          dataSource={list}
          scroll={{ x: 960 }}
          pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
          rowClassName={(r) => (r.status === "rework" ? "row-rework" : r.status === "done" ? "row-done" : "")}
        />
      </Card>

      <RegisterIssueModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
      <IssueDrawer
        issueId={activeId}
        onClose={() => setActiveId(null)}
        onSelectIssue={setActiveId}
      />
    </div>
  );
}
