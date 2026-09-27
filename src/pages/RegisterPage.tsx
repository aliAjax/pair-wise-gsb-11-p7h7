// 页面：登记异常（责任人、期限、现场说明必填；同设备重复异常给出提示并自动关联）

import { useMemo, useState } from "react";
import { Alert, AutoComplete, Button, Card, Form, Input, Select, message } from "antd";
import { AREAS, type Area } from "../data/types";
import { useStore } from "../store";
import { equipmentRecords, equipmentRectificationTotal } from "../domain/rules";

const COMMON_EQUIPMENT = ["加油机1号", "加油机2号", "卸油口密封", "油气回收泵", "液位仪", "收银台扫码枪"];

interface RegisterFormValues {
  equipment: string;
  area: Area;
  owner: string;
  deadline: string;
  description: string;
  reporter?: string;
}

export default function RegisterPage() {
  const records = useStore((s) => s.records);
  const registerAnomaly = useStore((s) => s.registerAnomaly);
  const [form] = Form.useForm<RegisterFormValues>();
  const [equipment, setEquipment] = useState("");
  const [lastResult, setLastResult] = useState("");
  const [messageApi, contextHolder] = message.useMessage();

  const equipmentOptions = useMemo(() => {
    const known = [...new Set([...COMMON_EQUIPMENT, ...records.map((r) => r.equipment)])];
    return known.map((v) => ({ value: v }));
  }, [records]);

  const history = useMemo(
    () => (equipment.trim() ? equipmentRecords(records, equipment.trim()) : []),
    [records, equipment]
  );

  const handleFinish = (values: RegisterFormValues) => {
    const result = registerAnomaly({
      equipment: values.equipment,
      area: values.area,
      description: values.description,
      owner: values.owner,
      deadline: values.deadline,
      reporter: values.reporter ?? "",
    });
    if (result.ok) {
      setLastResult(result.message);
      form.resetFields();
      setEquipment("");
    } else {
      messageApi.error(result.message);
    }
  };

  return (
    <Card title="登记异常">
      {contextHolder}
      {history.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message={`「${equipment.trim()}」已有 ${history.length} 条异常记录，累计整改 ${equipmentRectificationTotal(records, equipment.trim())} 次；本次登记将自动关联上一条记录并继续累加整改次数。`}
        />
      )}
      {lastResult && (
        <Alert
          type="success"
          showIcon
          closable
          style={{ marginBottom: 16 }}
          message={lastResult}
          onClose={() => setLastResult("")}
        />
      )}
      <Form<RegisterFormValues> form={form} layout="vertical" onFinish={handleFinish} style={{ maxWidth: 560 }}>
        <Form.Item name="equipment" label="设备名称" rules={[{ required: true, message: "请填写设备名称" }]}>
          <AutoComplete
            options={equipmentOptions}
            placeholder="选择或输入设备名称"
            onChange={(v) => setEquipment(String(v))}
            filterOption={(input, option) =>
              String(option?.value ?? "").toLowerCase().includes(input.toLowerCase())
            }
          />
        </Form.Item>
        <Form.Item name="area" label="区域" rules={[{ required: true, message: "请选择区域" }]}>
          <Select placeholder="请选择区域" options={AREAS.map((a) => ({ value: a, label: a }))} />
        </Form.Item>
        <Form.Item name="owner" label="责任人" rules={[{ required: true, message: "请填写责任人" }]}>
          <Input placeholder="整改责任人" />
        </Form.Item>
        <Form.Item name="deadline" label="整改期限" rules={[{ required: true, message: "请选择整改期限" }]}>
          <Input type="date" />
        </Form.Item>
        <Form.Item name="description" label="现场说明" rules={[{ required: true, message: "请填写现场说明" }]}>
          <Input.TextArea rows={3} placeholder="异常现象、具体位置、初步原因等" />
        </Form.Item>
        <Form.Item name="reporter" label="登记人">
          <Input placeholder="巡检登记人" />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          登记异常
        </Button>
      </Form>
    </Card>
  );
}
