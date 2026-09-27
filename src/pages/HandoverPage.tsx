import { useMemo, useState } from "react";
import {
  Alert,
  App as AntApp,
  Button,
  Card,
  Empty,
  Form,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  type Handover,
  type HandoverItemSnapshot,
  type IssueStatus,
  ISSUE_STATUS_META,
} from "../data/types";
import { useAppStore } from "../store/useAppStore";
import { blockedAreas, previewHandover, RuleError } from "../rules/engine";
import { deadlineText, fmtDateTime } from "../utils/format";

const { Text, Paragraph } = Typography;

export default function HandoverPage() {
  const { data, confirmShift, signShift } = useAppStore();
  const { message } = AntApp.useApp();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [detail, setDetail] = useState<Handover | null>(null);
  const [form] = Form.useForm();
  const [signForm] = Form.useForm();

  const active = data.handovers.find((h) => h.status === "awaiting_sign") ?? null;
  const preview = useMemo(() => previewHandover(data), [data]);
  const blocked = useMemo(() => blockedAreas(data), [data]);

  function doConfirm() {
    form.validateFields().then((values) => {
      try {
        confirmShift(values);
        message.success("班长已确认待办，等待接班人签收");
        form.resetFields();
        setConfirmOpen(false);
      } catch (err) {
        message.error(err instanceof RuleError ? err.message : "交班失败");
      }
    });
  }

  function doSign() {
    signForm.validateFields().then((values) => {
      if (!active) return;
      try {
        signShift(active.id, values);
        message.success("签收完成，待办已交接");
        signForm.resetFields();
        setSignOpen(false);
      } catch (err) {
        message.error(err instanceof RuleError ? err.message : "签收失败");
      }
    });
  }

  const columns: ColumnsType<HandoverItemSnapshot> = [
    {
      title: "区域",
      dataIndex: "area",
      width: 100,
      render: (v) => <Tag>{v}</Tag>,
    },
    { title: "设备", dataIndex: "deviceName" },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (v: IssueStatus) => (
        <Tag color={ISSUE_STATUS_META[v].color}>{ISSUE_STATUS_META[v].label}</Tag>
      ),
    },
    { title: "责任人", dataIndex: "owner", width: 90 },
    {
      title: "期限",
      dataIndex: "deadline",
      width: 170,
      render: (v, r) => (
        <Text type={v < new Date().toISOString().slice(0, 10) && r.status !== "done" ? "danger" : undefined}>
          {deadlineText(v, r.status !== "done")}
        </Text>
      ),
    },
  ];

  return (
    <div>
      {/* 复检未过区域：禁止交班的醒目提示 */}
      {blocked.length > 0 && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          message={`以下区域复检未合格，不能交班：${blocked.join("、")}`}
          description="请退回责任人继续整改，复检合格后系统才允许班长确认交班。待整改/待复检项可作为待办交接，但复检未过项必须当场闭环。"
        />
      )}

      {/* 进行中的交班单 */}
      <Card
        title="当前交班"
        style={{ marginBottom: 16 }}
        extra={
          active ? (
            <Space>
              <Text type="secondary">
                班长 {active.outLeader} 已于 {fmtDateTime(active.confirmedAt)} 确认待办
              </Text>
              <Button type="primary" onClick={() => setSignOpen(true)}>
                接班人签收
              </Button>
            </Space>
          ) : (
            <Popconfirm
              title="确认创建交班单？"
              description={
                blocked.length > 0
                  ? `存在复检未合格区域（${blocked.join("、")}），系统将拒绝交班。`
                  : "系统将按当前未关闭异常生成待办快照。"
              }
              onConfirm={() => setConfirmOpen(true)}
              okText="继续"
              cancelText="取消"
            >
              <Button type="primary" danger={blocked.length > 0}>
                班长确认待办并交班
              </Button>
            </Popconfirm>
          )
        }
      >
        {active ? (
          <>
            <Paragraph>
              交班班长：<Text strong>{active.outLeader}</Text>　备注：
              {active.remark || "无"}
            </Paragraph>
            <Table
              rowKey="issueId"
              size="small"
              columns={columns}
              dataSource={active.items}
              pagination={false}
            />
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              message="待接班人签收。签收前交班单不生效；签收后清单冻结为交接凭证。"
            />
          </>
        ) : (
          <>
            <Paragraph type="secondary">
              下方为当前全部未关闭异常，将作为交班待办。其中
              <Text strong type="danger"> 复检未过 </Text>
              项所在区域会被系统拦截，不允许交班。
            </Paragraph>
            <Table
              rowKey="issueId"
              size="small"
              columns={columns}
              dataSource={preview.items}
              pagination={false}
              locale={{
                emptyText: <Empty description="没有未关闭异常，可直接交班" />,
              }}
            />
          </>
        )}
      </Card>

      {/* 历史交班单 */}
      <Card title="交班记录（签收后冻结，可随时复查）">
        <List
          dataSource={data.handovers.filter((h) => h.status === "signed")}
          locale={{ emptyText: <Empty description="暂无已签收的交班记录" /> }}
          renderItem={(h) => (
            <List.Item
              actions={[
                <Button type="link" size="small" onClick={() => setDetail(h)}>
                  查看签收清单
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={
                  <Space wrap>
                    <Text strong>{fmtDateTime(h.createdAt)} 交班单</Text>
                    <Tag color="green">已签收</Tag>
                  </Space>
                }
                description={
                  <Space wrap split={<span>·</span>}>
                    <span>交班班长：{h.outLeader}</span>
                    <span>接班人：{h.receiver}</span>
                    <span>签收时间：{fmtDateTime(h.signedAt)}</span>
                    <span>待办 {h.items.length} 项</span>
                  </Space>
                }
              />
            </List.Item>
          )}
        />
      </Card>

      {/* 班长确认弹窗 */}
      <Modal
        title="班长确认交班待办"
        open={confirmOpen}
        onOk={doConfirm}
        onCancel={() => setConfirmOpen(false)}
        okText="确认待办，待接班人签收"
        cancelText="取消"
        okButtonProps={{ danger: blocked.length > 0 }}
      >
        {blocked.length > 0 && (
          <Alert
            type="error"
            showIcon
            style={{ marginBottom: 12 }}
            message={`复检未合格区域：${blocked.join("、")}，提交时系统将拒绝。`}
          />
        )}
        <Paragraph type="secondary">
          确认后系统将把上方 {preview.items.length} 项未关闭异常冻结为待办清单。
        </Paragraph>
        <Form form={form} layout="vertical">
          <Form.Item
            name="outLeader"
            label="交班班长"
            rules={[{ required: true, message: "请填写交班班长姓名" }]}
          >
            <Input placeholder="确认待办的班长" />
          </Form.Item>
          <Form.Item name="remark" label="交班备注">
            <Input.TextArea rows={2} placeholder="重点风险、夜间注意事项（口头交代之外必须写明）" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 接班人签收弹窗 */}
      <Modal
        title="接班人签收"
        open={signOpen}
        onOk={doSign}
        onCancel={() => setSignOpen(false)}
        okText="确认签收"
        cancelText="取消"
      >
        <Paragraph>
          请接班人逐项核对 {active?.items.length ?? 0} 项待办，确认无误后签名签收。
        </Paragraph>
        <Form form={signForm} layout="vertical">
          <Form.Item
            name="receiver"
            label="接班人签名"
            rules={[{ required: true, message: "接班人必须签名才能完成交接" }]}
          >
            <Input placeholder="接班人姓名" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 历史交班单详情 */}
      <Modal
        title={detail ? `交班单 · ${fmtDateTime(detail.createdAt)}` : ""}
        open={Boolean(detail)}
        onCancel={() => setDetail(null)}
        footer={null}
        width={720}
      >
        {detail && (
          <>
            <Timeline
              items={[
                { color: "blue", children: <>创建交班单 {fmtDateTime(detail.createdAt)}</> },
                {
                  color: "blue",
                  children: <>班长 {detail.outLeader} 确认待办 {fmtDateTime(detail.confirmedAt)}</>,
                },
                {
                  color: "green",
                  children: (
                    <>
                      接班人 <Text strong>{detail.receiver}</Text> 签收{" "}
                      {fmtDateTime(detail.signedAt)}
                    </>
                  ),
                },
              ]}
            />
            {detail.remark && (
              <Paragraph>
                <Text type="secondary">交班备注：</Text>
                {detail.remark}
              </Paragraph>
            )}
            <Table
              rowKey="issueId"
              size="small"
              columns={columns}
              dataSource={detail.items}
              pagination={false}
            />
          </>
        )}
      </Modal>
    </div>
  );
}
