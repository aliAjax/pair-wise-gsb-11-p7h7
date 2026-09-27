import { Form, Input, Modal, Select, DatePicker, App as AntApp } from "antd";
import dayjs from "dayjs";
import { useMemo } from "react";
import { AREAS, type Area } from "../../data/types";
import { useAppStore } from "../../store/useAppStore";
import { RuleError } from "../../rules/engine";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface FormValues {
  area: Area;
  deviceId: string;
  sceneNote: string;
  owner: string;
  deadline: dayjs.Dayjs;
  recorder: string;
}

export default function RegisterIssueModal({ open, onClose }: Props) {
  const [form] = Form.useForm<FormValues>();
  const { data, register } = useAppStore();
  const { message } = AntApp.useApp();
  const area = Form.useWatch("area", form) as Area | undefined;

  const deviceOptions = useMemo(
    () =>
      data.devices
        .filter((d) => !area || d.area === area)
        .map((d) => ({
          value: d.id,
          label: d.openIssueId
            ? `${d.name}（有未关闭异常，不可重复登记）`
            : d.name,
          disabled: Boolean(d.openIssueId),
        })),
    [data.devices, area]
  );

  function handleOk() {
    form
      .validateFields()
      .then((values) => {
        try {
          register({
            area: values.area,
            deviceId: values.deviceId,
            sceneNote: values.sceneNote,
            owner: values.owner,
            deadline: values.deadline.format("YYYY-MM-DD"),
            recorder: values.recorder,
          });
          message.success("异常已登记，责任人、期限与现场说明已写入");
          form.resetFields();
          onClose();
        } catch (err) {
          message.error(err instanceof RuleError ? err.message : "登记失败");
        }
      })
      .catch(() => undefined);
  }

  return (
    <Modal
      title="登记异常"
      open={open}
      onOk={handleOk}
      onCancel={() => {
        form.resetFields();
        onClose();
      }}
      okText="登记并派发整改"
      cancelText="取消"
      destroyOnClose
      width={560}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ area: undefined, deadline: dayjs().add(1, "day") }}
        style={{ marginTop: 12 }}
      >
        <Form.Item
          name="area"
          label="区域"
          rules={[{ required: true, message: "请选择区域" }]}
        >
          <Select
            placeholder="选择区域"
            options={AREAS.map((a) => ({ value: a, label: a }))}
            onChange={() => form.setFieldValue("deviceId", undefined)}
          />
        </Form.Item>
        <Form.Item
          name="deviceId"
          label="设备"
          rules={[{ required: true, message: "请选择设备" }]}
          extra="同一设备存在未关闭异常时不可重复登记；复检合格后再次出现将自动记为第 2 次异常并累加整改次数。"
        >
          <Select
            placeholder={area ? "选择设备" : "请先选择区域"}
            options={deviceOptions}
            disabled={!area}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          name="sceneNote"
          label="现场说明"
          rules={[{ required: true, message: "现场说明必须填写（异常现象、已采取的临时措施）" }]}
        >
          <Input.TextArea
            rows={3}
            placeholder="写明异常现象、发现位置、现场已采取的临时措施，禁止只填'异常'"
          />
        </Form.Item>
        <div style={{ display: "flex", gap: 12 }}>
          <Form.Item
            name="owner"
            label="责任人"
            style={{ flex: 1 }}
            rules={[{ required: true, message: "请填写责任人" }]}
          >
            <Input placeholder="整改责任人姓名" />
          </Form.Item>
          <Form.Item
            name="deadline"
            label="整改期限"
            style={{ flex: 1 }}
            rules={[{ required: true, message: "请选择期限" }]}
          >
            <DatePicker
              style={{ width: "100%" }}
              allowClear={false}
              disabledDate={(d) => d.isBefore(dayjs().startOf("day"))}
            />
          </Form.Item>
        </div>
        <Form.Item
          name="recorder"
          label="登记人"
          rules={[{ required: true, message: "请填写登记人" }]}
        >
          <Input placeholder="巡检登记人" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
