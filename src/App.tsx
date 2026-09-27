import { useMemo, useState } from "react";
import {
  App as AntApp,
  Badge,
  ConfigProvider,
  Layout,
  Tabs,
  Typography,
  theme,
} from "antd";
import zhCN from "antd/locale/zh_CN";
import { useAppStore } from "./store/useAppStore";
import { blockedAreas } from "./rules/engine";
import RegistryPage from "./pages/RegistryPage";
import HandoverPage from "./pages/HandoverPage";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export default function App() {
  const data = useAppStore((s) => s.data);
  const [tab, setTab] = useState("registry");
  const blocked = useMemo(() => blockedAreas(data), [data]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: { colorPrimary: "#176b87", borderRadius: 8 },
        algorithm: theme.defaultAlgorithm,
      }}
    >
      <AntApp>
        <Layout style={{ minHeight: "100vh", background: "#eef2f7" }}>
          <Header
            style={{
              background: "#fff",
              borderBottom: "1px solid #dfe7f1",
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              gap: 16,
              position: "sticky",
              top: 0,
              zIndex: 10,
            }}
          >
            <Title level={4} style={{ margin: 0, whiteSpace: "nowrap" }}>
              油站巡检整改交接台
            </Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              登记即定责任人与期限 · 复检不合格不交班 · 完成记录冻结留痕
            </Text>
          </Header>
          <Content style={{ padding: 24, maxWidth: 1200, width: "100%", margin: "0 auto" }}>
            <Tabs
              activeKey={tab}
              onChange={setTab}
              items={[
                { key: "registry", label: "异常整改台账" },
                {
                  key: "handover",
                  label: (
                    <span>
                      交班台
                      {blocked.length > 0 && (
                        <Badge
                          count={`${blocked.length}区拦停`}
                          style={{
                            backgroundColor: "#cf1322",
                            marginLeft: 8,
                            fontSize: 11,
                          }}
                        />
                      )}
                    </span>
                  ),
                },
              ]}
            />
            {tab === "registry" ? <RegistryPage /> : <HandoverPage />}
          </Content>
        </Layout>
      </AntApp>
    </ConfigProvider>
  );
}
