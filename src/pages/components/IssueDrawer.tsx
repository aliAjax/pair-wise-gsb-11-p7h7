import {
  Alert,
  App as AntApp,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  Radio,
  Space,
  Tag,
  Timeline,
  Typography,
} from "antd";
import { ISSUE_STATUS_META } from "../../data/types";
import { useAppStore } from "../../store/useAppStore";
import {
  deviceHistory,
  isOverdue,
  RuleError,
} from "../../rules/engine";
import { deadlineText, fmtDateTime } from "../../utils/format";

const { Text, Paragraph } = Typography;

interface Props {
  issueId: string | null;
  onClose: () => void;
  onSelectIssue: (id: string) => void;
}

export default function IssueDrawer({ issueId, onClose, onSelectIssue }: Props) {
  const { data, rectify, doRecheck, amend } = useAppStore();
  const { message } = AntApp.useApp();
  const [rectForm] = Form.useForm();
  const [checkForm] = Form.useForm();
  const [amendForm] = Form.useForm();

  const issue = data.issues.find((i) => i.id === issueId) ?? null;
  const history = issue ? deviceHistory(data, issue.deviceId) : [];
  const device = issue ? data.devices.find((d) => d.id === issue.deviceId) : null;

  function guard(fn: () => void) {
    try {
      fn();
      message.success("操作成功");
      rectForm.resetFields();
      checkForm.resetFields();
    } catch (err) {
      message.error(err instanceof RuleError ? err.message : "操作失败");
    }
  }

  return (
    <Drawer
      title={issue ? `异常单详情 · ${issue.deviceName}` : ""}
      width={620}
      open={Boolean(issue)}
      onClose={onClose}
      destroyOnClose
    >
      {issue && (
        <>
          <Space wrap style={{ marginBottom: 12 }}>
            <Tag color={ISSUE_STATUS_META[issue.status].color}>
              {ISSUE_STATUS_META[issue.status].label}
            </Tag>
            <Tag>{issue.area}</Tag>
            <Tag color="purple">第 {issue.occurrenceNo} 次异常</Tag>
            {isOverdue(issue) && <Tag color="volcano">已逾期</Tag>}
            {issue.status === "done" && <Tag color="default">记录已冻结</Tag>}
          </Space>

          {device && (
            <Alert
              type="info"
              style={{ marginBottom: 16 }}
              message={
                <Space size="small" wrap>
                  <Text strong>{device.name}</Text>
                  <Text type="secondary">
                    累计异常 {device.occurrenceCount} 次 · 累计整改 {device.rectificationCount} 次
                  </Text>
                </Space>
              }
            />
          )}

          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="责任人">{issue.owner}</Descriptions.Item>
            <Descriptions.Item label="期限">
              {deadlineText(issue.deadline, issue.status !== "done")}
            </Descriptions.Item>
            <Descriptions.Item label="登记人">{issue.recorder}</Descriptions.Item>
            <Descriptions.Item label="登记时间">
              {fmtDateTime(issue.createdAt)}
            </Descriptions.Item>
            <Descriptions.Item label="现场说明" span={2}>
              {issue.sceneNote}
            </Descriptions.Item>
            <Descriptions.Item label="完成时间" span={2}>
              {fmtDateTime(issue.completedAt)}
            </Descriptions.Item>
          </Descriptions>

          {/* 同一设备的前后异常记录 */}
          {history.length > 1 && (
            <>
              <Divider orientation="left">该设备前后异常记录</Divider>
              <Space direction="vertical" style={{ width: "100%" }}>
                {history.map((h) => (
                  <Button
                    key={h.id}
                    block
                    type={h.id === issue.id ? "primary" : "default"}
                    style={{ textAlign: "left" }}
                    onClick={() => onSelectIssue(h.id)}
                  >
                    第 {h.occurrenceNo} 次 · {ISSUE_STATUS_META[h.status].label} ·{" "}
                    责任人 {h.owner} · 登记 {fmtDateTime(h.createdAt)}
                  </Button>
                ))}
              </Space>
            </>
          )}

          <Divider orientation="left">处理时间线</Divider>
          <Timeline
            items={[
              {
                color: "gray",
                children: (
                  <>
                    <Text strong>登记异常</Text>　{fmtDateTime(issue.createdAt)}
                    <br />
                    <Text type="secondary">
                      {issue.recorder} 登记 · 责任人 {issue.owner} · 期限 {issue.deadline}
                    </Text>
                    <br />
                    <Text type="secondary">{issue.sceneNote}</Text>
                  </>
                ),
              },
              ...issue.rectifications.map((r) => ({
                color: "blue" as const,
                children: (
                  <>
                    <Text strong>第 {r.round} 次整改</Text>　{fmtDateTime(r.at)}
                    <br />
                    <Text type="secondary">
                      {r.handler}：{r.action}
                    </Text>
                  </>
                ),
              })),
              ...issue.rechecks.map((r) => ({
                color: (r.passed ? "green" : "red") as "green" | "red",
                children: (
                  <>
                    <Text strong>复检{r.passed ? "合格" : "未过"}</Text>
                    {fmtDateTime(r.at)}
                    <br />
                    <Text type="secondary">
                      {r.checker}：{r.note}
                    </Text>
                  </>
                ),
              })),
              ...(issue.completedAt
                ? [
                    {
                      color: "green" as const,
                      children: (
                        <>
                          <Text strong>记录冻结</Text>　{fmtDateTime(issue.completedAt)}
                        </>
                      ),
                    },
                  ]
                : []),
            ]}
          />

          {/* 操作区：待整改 / 复检未过 -> 提交整改 */}
          {(issue.status === "pending" || issue.status === "rework") && (
            <>
              <Divider orientation="left">提交整改</Divider>
              {issue.status === "rework" && (
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="上次复检未合格，本次提交将累加一次整改次数。"
                />
              )}
              <Form
                form={rectForm}
                layout="vertical"
                onFinish={(values) =>
                  guard(() => rectify(issue.id, values))
                }
              >
                <Form.Item
                  name="handler"
                  label="整改人"
                  rules={[{ required: true, message: "请填写整改人" }]}
                >
                  <Input placeholder="实际处理人" />
                </Form.Item>
                <Form.Item
                  name="action"
                  label="整改说明"
                  rules={[{ required: true, message: "请填写整改措施，不能只口头交代" }]}
                >
                  <Input.TextArea
                    rows={2}
                    placeholder="写明处理措施、更换件、停机/恢复情况"
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  提交整改，转待复检
                </Button>
              </Form>
            </>
          )}

          {/* 操作区：待复检 -> 复检判定 */}
          {issue.status === "recheck" && (
            <>
              <Divider orientation="left">复检判定</Divider>
              <Form
                form={checkForm}
                layout="vertical"
                initialValues={{ passed: true }}
                onFinish={(values) =>
                  guard(() => doRecheck(issue.id, values))
                }
              >
                <Form.Item name="passed" label="复检结果">
                  <Radio.Group
                    optionType="button"
                    buttonStyle="solid"
                    options={[
                      { value: true, label: "合格（冻结完成记录）" },
                      { value: false, label: "不合格（退回整改，区域将被禁止交班）" },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="checker"
                  label="复检人"
                  rules={[{ required: true, message: "请填写复检人" }]}
                >
                  <Input placeholder="复检确认人" />
                </Form.Item>
                <Form.Item
                  name="note"
                  label="复检意见"
                  rules={[{ required: true, message: "请填写复检意见" }]}
                >
                  <Input.TextArea rows={2} placeholder="判定依据、现场复核情况" />
                </Form.Item>
                <Button type="primary" htmlType="submit">
                  提交复检结果
                </Button>
              </Form>
            </>
          )}

          {/* 完成后：只能补写，且留痕 */}
          {issue.status === "done" && (
            <>
              <Divider orientation="left">完成记录（冻结）</Divider>
              <Paragraph type="secondary" style={{ fontSize: 13 }}>
                记录已冻结，不得直接改写。确需补写/更正时必须填写原因，系统保留改前内容与操作人。
              </Paragraph>

              {issue.amendments.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {issue.amendments.map((a, idx) => (
                    <Alert
                      key={idx}
                      type="warning"
                      style={{ marginBottom: 8 }}
                      message={`补写记录 · ${fmtDateTime(a.at)} · ${a.author}`}
                      description={
                        <div>
                          <div>
                            <Text type="secondary">原因：</Text>
                            {a.reason}
                          </div>
                          {Object.entries(a.before).map(([k, v]) => (
                            <div key={k} style={{ marginTop: 4 }}>
                              <Text delete type="secondary">
                                [{amendFieldLabel(k)}改前] {renderOldValue(k, v)}
                              </Text>
                              <br />
                              <Text type="success">
                                [{amendFieldLabel(k)}改后] {String((a.after as Record<string, unknown>)[k] ?? "")}
                              </Text>
                            </div>
                          ))}
                        </div>
                      }
                    />
                  ))}
                </div>
              )}

              <Form
                form={amendForm}
                layout="vertical"
                onFinish={(values) =>
                  guard(() => {
                    amend(issue.id, values);
                    amendForm.resetFields();
                  })
                }
              >
                <Form.Item
                  name="sceneNote"
                  label="补写现场说明（留空表示不改）"
                >
                  <Input.TextArea rows={2} placeholder={`当前：${issue.sceneNote}`} />
                </Form.Item>
                <div style={{ display: "flex", gap: 12 }}>
                  <Form.Item name="owner" label="更正责任人" style={{ flex: 1 }}>
                    <Input placeholder={`当前：${issue.owner}`} />
                  </Form.Item>
                  <Form.Item name="deadline" label="更正期限" style={{ flex: 1 }}>
                    <Input placeholder={`当前：${issue.deadline}`} />
                  </Form.Item>
                </div>
                <Form.Item
                  name="author"
                  label="操作人"
                  rules={[{ required: true, message: "请填写操作人" }]}
                >
                  <Input placeholder="执行补写的人" />
                </Form.Item>
                <Form.Item
                  name="reason"
                  label="补写/更正原因"
                  rules={[{ required: true, message: "补写必须填写原因" }]}
                >
                  <Input.TextArea rows={2} placeholder="如：依据维修回执补正归档信息" />
                </Form.Item>
                <Button type="primary" htmlType="submit" danger>
                  提交补写（自动留痕）
                </Button>
              </Form>
            </>
          )}
        </>
      )}
    </Drawer>
  );
}

function amendFieldLabel(key: string): string {
  const map: Record<string, string> = {
    sceneNote: "现场说明",
    owner: "责任人",
    deadline: "期限",
  };
  return map[key] ?? key;
}

function renderOldValue(key: string, value: unknown): string {
  void key;
  return String(value ?? "");
}
