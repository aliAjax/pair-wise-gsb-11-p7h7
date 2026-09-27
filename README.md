# 油站整改交接台

- 行业：石油
- 技术栈：React、Vite、TypeScript、Zustand、Ant Design
- 启动：`npm install && npm run dev`
- 构建：`npm run build`

巡检发现异常后登记整改单：责任人、期限、现场说明必填；同设备重复异常自动关联前后记录并累加整改次数。
复检不合格的区域不能交班；交接班由班长确认待办、接班人签收；完成记录冻结，补写结果需留原因与改前内容。
数据保存在浏览器 localStorage，刷新/重开后仍可按设备、区域、状态查询。

## 目录结构（数据、判定、存储、页面分离）

- `src/data/types.ts` 数据：领域模型（整改单、整改记录、复检、补写留痕、交接班单）
- `src/data/seed.ts` 数据：首次启动的种子数据
- `src/data/storage.ts` 存储：localStorage 读写
- `src/domain/rules.ts` 判定：状态流转、复检、交接班、补写等业务规则（纯函数）
- `src/store.ts` 状态：Zustand 连接判定与存储
- `src/pages/` 页面：整改台账、登记异常、交接班
