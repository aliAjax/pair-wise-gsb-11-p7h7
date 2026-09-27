// 数据层：领域模型与常量定义

export const AREAS = ["加油区", "油罐区", "收银区", "卸油区"] as const;
export type Area = (typeof AREAS)[number];

export const RECORD_STATUSES = ["待整改", "待复检", "已完成"] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/** 复检结论 */
export interface Recheck {
  at: string;
  by: string;
  passed: boolean;
  note: string;
}

/** 一次整改记录（可带复检结论） */
export interface RectificationEntry {
  id: string;
  at: string;
  by: string;
  summary: string;
  recheck: Recheck | null;
}

/** 完成冻结后的补写留痕 */
export interface Amendment {
  id: string;
  at: string;
  by: string;
  reason: string;
  before: string;
  after: string;
}

/** 异常整改单 */
export interface AnomalyRecord {
  id: string;
  code: string;
  equipment: string;
  area: Area;
  description: string;
  owner: string;
  deadline: string;
  reporter: string;
  createdAt: string;
  status: RecordStatus;
  entries: RectificationEntry[];
  amendments: Amendment[];
  /** 同设备上一条异常记录，重复异常时保留前后链条 */
  prevRecordId: string | null;
  /** 整改结论，完成后冻结，仅可通过补写修改 */
  resultNote: string;
  frozenAt: string | null;
}

export const HANDOVER_STATUSES = ["待班长确认", "待签收", "已签收"] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

/** 交接时的待办快照，生成后不再随记录变化 */
export interface HandoverPendingItem {
  recordId: string;
  code: string;
  equipment: string;
  area: Area;
  status: RecordStatus;
  owner: string;
  deadline: string;
}

/** 交接班单 */
export interface Handover {
  id: string;
  code: string;
  shiftName: string;
  createdAt: string;
  createdBy: string;
  status: HandoverStatus;
  pending: HandoverPendingItem[];
  leader: string | null;
  confirmedAt: string | null;
  successor: string | null;
  signedAt: string | null;
}

export interface PersistedState {
  records: AnomalyRecord[];
  handovers: Handover[];
}
