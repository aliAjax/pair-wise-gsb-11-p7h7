// ============ 数据层：领域模型与持久化结构 ============
// 本文件只描述"数据长什么样"，不包含任何业务判定与页面代码。

export const AREAS = ["加油区", "油罐区", "收银区", "配电区"] as const;
export type Area = (typeof AREAS)[number];

/** 异常整改状态 */
export type IssueStatus =
  | "pending" // 待整改（已登记，整改中）
  | "recheck" // 待复检（整改完成，等待复检）
  | "rework" // 复检未过（退回整改）
  | "done"; // 已完成（复检合格，记录冻结）

export const ISSUE_STATUS_META: Record<
  IssueStatus,
  { label: string; color: string }
> = {
  pending: { label: "待整改", color: "gold" },
  recheck: { label: "待复检", color: "blue" },
  rework: { label: "复检未过", color: "red" },
  done: { label: "已完成", color: "green" },
};

export const OPEN_STATUSES: IssueStatus[] = ["pending", "recheck", "rework"];

/** 设备档案：同一设备在系统中只有唯一一条档案 */
export interface Device {
  id: string;
  name: string;
  area: Area;
  /** 累计异常次数（每次该设备出现新异常 +1） */
  occurrenceCount: number;
  /** 累计整改次数（登记即计 1，复检退回后再次整改 +1） */
  rectificationCount: number;
  /** 当前未关闭的异常 id（同一设备同时只保留一条活动异常，重复登记会被拦下） */
  openIssueId: string | null;
}

/** 一次复检结果 */
export interface RecheckRecord {
  at: string;
  checker: string;
  passed: boolean;
  note: string;
}

/** 一次整改动作 */
export interface RectificationRecord {
  round: number;
  at: string;
  handler: string;
  action: string;
}

/** 完成后补写/更正留下的审计痕迹（只追加，不改写） */
export interface Amendment {
  at: string;
  author: string;
  reason: string;
  /** 改前内容（完成时冻结的字段） */
  before: Partial<Issue>;
  /** 补写后的内容 */
  after: Partial<Issue>;
}

/** 异常登记单 */
export interface Issue {
  id: string;
  area: Area;
  deviceId: string;
  deviceName: string;
  /** 该设备第几次异常（从 1 开始） */
  occurrenceNo: number;
  /** 同一设备历次异常串联，首条异常 id 即链 id */
  chainId: string;

  status: IssueStatus;
  sceneNote: string; // 现场说明（登记时必填）
  owner: string; // 责任人
  deadline: string; // 期限（YYYY-MM-DD）
  createdAt: string; // 登记时间 ISO
  recorder: string; // 登记人

  rectifications: RectificationRecord[];
  rechecks: RecheckRecord[];
  completedAt: string | null;

  amendments: Amendment[];
}

/** 交班快照中的待办条目 */
export interface HandoverItemSnapshot {
  issueId: string;
  area: Area;
  deviceName: string;
  status: IssueStatus;
  owner: string;
  deadline: string;
  occurrenceNo: number;
}

/** 交班单 */
export interface Handover {
  id: string;
  createdAt: string;
  /** 交班班长（确认待办） */
  outLeader: string;
  confirmedAt: string | null;
  /** 接班人（签收） */
  receiver: string | null;
  signedAt: string | null;
  remark: string;
  status: "awaiting_sign" | "signed";
  /** 确认时冻结的待办清单与受拦区域，签收后即为历史凭证 */
  items: HandoverItemSnapshot[];
  blockedAreas: Area[];
}

export interface AppData {
  version: number;
  devices: Device[];
  issues: Issue[];
  handovers: Handover[];
}
