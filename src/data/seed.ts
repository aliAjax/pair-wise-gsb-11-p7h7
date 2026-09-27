// ============ 数据层：初始种子数据（仅首次打开时使用） ============
import type { AppData, Device, Issue } from "./types";

// 以"今天"为基准造演示数据，保证期限、逾期、交班时间线始终合理
function daysAgoISO(days: number, hour = 9): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}
function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysAgoAt(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildSeedData(): AppData {
  const devices: Device[] = [
    { id: "dev-1", name: "1号加油机", area: "加油区", occurrenceCount: 1, rectificationCount: 1, openIssueId: "iss-1" },
    { id: "dev-2", name: "2号加油机", area: "加油区", occurrenceCount: 1, rectificationCount: 2, openIssueId: "iss-2" },
    { id: "dev-3", name: "3号加油机", area: "加油区", occurrenceCount: 2, rectificationCount: 3, openIssueId: "iss-5" },
    { id: "dev-4", name: "卸油口密封装置", area: "油罐区", occurrenceCount: 1, rectificationCount: 1, openIssueId: "iss-3" },
    { id: "dev-5", name: "油罐液位仪", area: "油罐区", occurrenceCount: 0, rectificationCount: 0, openIssueId: null },
    { id: "dev-6", name: "收银POS机", area: "收银区", occurrenceCount: 0, rectificationCount: 0, openIssueId: null },
    { id: "dev-7", name: "配电柜", area: "配电区", occurrenceCount: 0, rectificationCount: 0, openIssueId: null },
  ];

  const issues: Issue[] = [
    {
      id: "iss-1",
      area: "加油区",
      deviceId: "dev-1",
      deviceName: "1号加油机",
      occurrenceNo: 1,
      chainId: "iss-1",
      status: "pending",
      sceneNote: "油枪胶管接头有油渍，疑似渗漏，现场已停用并放置警示牌。",
      owner: "王强",
      deadline: daysFromNow(1),
      createdAt: daysAgoISO(0, 8),
      recorder: "何鑫",
      rectifications: [],
      rechecks: [],
      completedAt: null,
      amendments: [],
    },
    {
      id: "iss-2",
      area: "加油区",
      deviceId: "dev-2",
      deviceName: "2号加油机",
      occurrenceNo: 1,
      chainId: "iss-2",
      status: "recheck",
      sceneNote: "显示屏缺笔画，金额显示不完整。",
      owner: "李敏",
      deadline: today(),
      createdAt: daysAgoISO(2, 9),
      recorder: "何鑫",
      rectifications: [
        { round: 1, at: daysAgoISO(1, 10), handler: "李敏", action: "自行紧固排线，故障依旧。" },
        { round: 2, at: daysAgoISO(0, 7), handler: "李敏", action: "厂家更换显示模组，自检显示正常，申请复检。" },
      ],
      rechecks: [],
      completedAt: null,
      amendments: [],
    },
    {
      id: "iss-3",
      area: "油罐区",
      deviceId: "dev-4",
      deviceName: "卸油口密封装置",
      occurrenceNo: 1,
      chainId: "iss-3",
      status: "rework",
      sceneNote: "密封圈老化开裂，卸油时有油气明显逸出。",
      owner: "赵磊",
      deadline: today(),
      createdAt: daysAgoISO(3, 9),
      recorder: "周倩",
      rectifications: [
        { round: 1, at: daysAgoISO(2, 14), handler: "赵磊", action: "更换同规格密封圈并紧固卡箍。" },
      ],
      rechecks: [
        { at: daysAgoISO(1, 16), checker: "周倩", passed: false, note: "卡箍处仍有微量油气味，密封面未压实，退回整改。" },
      ],
      completedAt: null,
      amendments: [],
    },
    {
      id: "iss-4",
      area: "收银区",
      deviceId: "dev-6",
      deviceName: "收银POS机",
      occurrenceNo: 1,
      chainId: "iss-4",
      status: "done",
      sceneNote: "扫码枪偶发断连，高峰时影响结算。",
      owner: "孙丽",
      deadline: daysAgoISO(4),
      createdAt: daysAgoISO(6, 9),
      recorder: "何鑫",
      rectifications: [
        { round: 1, at: daysAgoISO(5, 11), handler: "孙丽", action: "更换扫码枪USB连接线，重新配对。" },
      ],
      rechecks: [
        { at: daysAgoISO(4, 9), checker: "周倩", passed: true, note: "连续扫码50笔无断连，复检合格。" },
      ],
      completedAt: daysAgoISO(4, 9),
      amendments: [
        {
          at: daysAgoISO(3, 15),
          author: "周倩",
          reason: "归档复盘时调取监控，补充异常发生时的现场影响范围。",
          before: { sceneNote: "扫码枪偶发断连，高峰时影响结算。" },
          after: {
            sceneNote:
              "扫码枪偶发断连，高峰时影响结算；经查USB线外皮破损，高峰10分钟内断连3次，已临时改用备用扫码枪。",
          },
        },
      ],
    },
    {
      id: "iss-5",
      area: "加油区",
      deviceId: "dev-3",
      deviceName: "3号加油机",
      occurrenceNo: 2,
      chainId: "iss-5a",
      status: "rework",
      sceneNote: "再次出现加油结束后跳数异常（上月同类问题已整改一次），差值约0.05升。",
      owner: "王强",
      deadline: today(),
      createdAt: daysAgoISO(1, 10),
      recorder: "何鑫",
      rectifications: [
        { round: 1, at: daysAgoISO(0, 8), handler: "王强", action: "校准流量计并更换电磁阀密封垫。" },
      ],
      rechecks: [
        { at: daysAgoISO(0, 11), checker: "周倩", passed: false, note: "试加注三次仍有一次跳数，未达标，继续整改。" },
      ],
      completedAt: null,
      amendments: [],
    },
  ];

  const handovers: AppData["handovers"] = [
    {
      id: "ho-1",
      createdAt: daysAgoISO(1, 21),
      outLeader: "周倩",
      confirmedAt: daysAgoAt(1, 21, 30),
      receiver: "陈国栋",
      signedAt: daysAgoAt(1, 22),
      remark: "油罐区密封圈问题跟进中，夜班注意闻味巡查。",
      status: "signed",
      items: [
        { issueId: "iss-3", area: "油罐区", deviceName: "卸油口密封装置", status: "pending", owner: "赵磊", deadline: today(), occurrenceNo: 1 },
        { issueId: "iss-2", area: "加油区", deviceName: "2号加油机", status: "pending", owner: "李敏", deadline: today(), occurrenceNo: 1 },
      ],
      blockedAreas: [],
    },
  ];

  return { version: 1, devices, issues, handovers };
}
