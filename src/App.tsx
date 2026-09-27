// 外壳：标题、指标与页面切换；数据/判定/存储分别在 data、domain、store 中

import { useMemo, useState } from "react";
import { Alert, Card, Col, Row, Statistic, Tabs } from "antd";
import { useStore } from "./store";
import { blockedAreas } from "./domain/rules";
import BoardPage from "./pages/BoardPage";
import RegisterPage from "./pages/RegisterPage";
import HandoverPage from "./pages/HandoverPage";

export default function App() {
  const records = useStore((s) => s.records);
  const [tab, setTab] = useState("board");

  const blocked = useMemo(() => blockedAreas(records), [records]);
  const countOf = (status: string) => records.filter((r) => r.status === status).length;

  return (
    <main className="app">
      <div className="shell">
        <header className="topbar">
          <p className="eyebrow">石油行业 · 巡检整改闭环</p>
          <h1>油站整改交接台</h1>
          <p className="subtitle">
            异常登记写明责任人、期限与现场说明；同设备重复异常自动关联前后记录并累加整改次数；
            复检不合格的区域不能交班，班长确认待办后由接班人签收；完成记录冻结，补写结果留原因与改前内容。
          </p>
        </header>

        {blocked.length > 0 && (
          <Alert
            className="block-alert"
            type="error"
            showIcon
            message={`复检未合格区域：${blocked.join("、")}，整改复检合格前不能交班`}
          />
        )}

        <Row gutter={[16, 16]} className="metrics">
          <Col xs={12} md={6}>
            <Card><Statistic title="待整改" value={countOf("待整改")} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card><Statistic title="待复检" value={countOf("待复检")} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card><Statistic title="已完成（冻结）" value={countOf("已完成")} /></Card>
          </Col>
          <Col xs={12} md={6}>
            <Card>
              <Statistic
                title="复检不合格区域"
                value={blocked.length}
                valueStyle={{ color: blocked.length > 0 ? "#cf1322" : undefined }}
              />
            </Card>
          </Col>
        </Row>

        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            { key: "board", label: "整改台账", children: <BoardPage /> },
            { key: "register", label: "登记异常", children: <RegisterPage /> },
            { key: "handover", label: "交接班", children: <HandoverPage /> },
          ]}
        />
      </div>
    </main>
  );
}
