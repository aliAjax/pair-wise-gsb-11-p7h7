// 判定层：全部业务规则均为纯函数，输入旧数据返回新数据，不合法直接抛错

import type {
  AnomalyRecord,
  Area,
  Handover,
  HandoverPendingItem,
} from "../data/types";

export interface RegisterInput {
  equipment: string;
  area: Area;
  description: string;
  owner: string;
  deadline: string;
  reporter: string;
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeCode(prefix: string, at: Date, seq: number): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${prefix}-${y}${m}${d}-${String(seq).padStart(3, "0")}`;
}

function todayStr(at = new Date()): string {
  const m = String(at.getMonth() + 1).padStart(2, "0");
  const d = String(at.getDate()).padStart(2, "0");
  return `${at.getFullYear()}-${m}-${d}`;
}

// ---------- 查询判定 ----------

/** 单条记录的整改次数 */
export function rectificationCount(record: AnomalyRecord): number {
  return record.entries.length;
}

/** 同设备的全部异常记录，按登记时间升序 */
export function equipmentRecords(records: AnomalyRecord[], equipment: string): AnomalyRecord[] {
  return records
    .filter((r) => r.equipment === equipment)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 该记录是同设备第几次异常 */
export function occurrenceIndex(records: AnomalyRecord[], record: AnomalyRecord): number {
  return equipmentRecords(records, record.equipment).findIndex((r) => r.id === record.id) + 1;
}

/** 同设备累计整改次数（重复异常时逐次累加） */
export function equipmentRectificationTotal(records: AnomalyRecord[], equipment: string): number {
  return equipmentRecords(records, equipment).reduce((sum, r) => sum + rectificationCount(r), 0);
}

/** 最近一次复检不合格且记录仍未关闭 */
export function lastRecheckFailed(record: AnomalyRecord): boolean {
  if (record.status === "已完成") return false;
  const last = record.entries[record.entries.length - 1];
  return !!last && last.recheck !== null && !last.recheck.passed;
}

/** 复检未合格的区域，这些区域不能交班 */
export function blockedAreas(records: AnomalyRecord[]): Area[] {
  const areas = records.filter(lastRecheckFailed).map((r) => r.area);
  return [...new Set(areas)];
}

/** 未完成的待办记录 */
export function pendingRecords(records: AnomalyRecord[]): AnomalyRecord[] {
  return records.filter((r) => r.status !== "已完成");
}

export function isOverdue(record: AnomalyRecord, at = new Date()): boolean {
  return record.status !== "已完成" && record.deadline < todayStr(at);
}

/** 当前仍在流转（未签收）的交接单 */
export function activeHandover(handovers: Handover[]): Handover | undefined {
  return handovers.find((h) => h.status !== "已签收");
}

// ---------- 整改单流转 ----------

/** 登记异常：责任人、期限、现场说明必填；同设备重复异常自动挂到上一条之后 */
export function registerAnomaly(
  records: AnomalyRecord[],
  input: RegisterInput,
  at = new Date()
): AnomalyRecord {
  const equipment = input.equipment.trim();
  if (!equipment) throw new Error("请填写设备名称");
  if (!input.owner.trim()) throw new Error("请填写责任人");
  if (!input.deadline) throw new Error("请选择整改期限");
  if (!input.description.trim()) throw new Error("请填写现场说明");

  const chain = equipmentRecords(records, equipment);
  const prev = chain.length > 0 ? chain[chain.length - 1] : null;

  return {
    id: uid(),
    code: makeCode("ZG", at, records.length + 1),
    equipment,
    area: input.area,
    description: input.description.trim(),
    owner: input.owner.trim(),
    deadline: input.deadline,
    reporter: input.reporter.trim() || "未署名",
    createdAt: at.toISOString(),
    status: "待整改",
    entries: [],
    amendments: [],
    prevRecordId: prev ? prev.id : null,
    resultNote: "",
    frozenAt: null,
  };
}

/** 提交整改：每提交一次整改次数累加一次，进入待复检 */
export function submitRectification(
  record: AnomalyRecord,
  by: string,
  summary: string,
  at = new Date()
): AnomalyRecord {
  if (record.status === "已完成") throw new Error("记录已完成并冻结，如需修正请使用补写结果");
  if (record.status !== "待整改") throw new Error("当前状态为待复检，请先完成复检");
  if (!by.trim()) throw new Error("请填写整改人");
  if (!summary.trim()) throw new Error("请填写整改说明");

  const entry = {
    id: uid(),
    at: at.toISOString(),
    by: by.trim(),
    summary: summary.trim(),
    recheck: null,
  };
  return { ...record, status: "待复检", entries: [...record.entries, entry] };
}

/** 复检：合格则完成并冻结；不合格退回待整改，前后整改记录都保留 */
export function recheckRectification(
  record: AnomalyRecord,
  passed: boolean,
  by: string,
  note: string,
  at = new Date()
): AnomalyRecord {
  if (record.status !== "待复检") throw new Error("只有待复检状态的记录才能复检");
  if (!by.trim()) throw new Error("请填写复检人");

  const entries = [...record.entries];
  const last = entries[entries.length - 1];
  if (!last || last.recheck) throw new Error("没有待复检的整改记录");
  entries[entries.length - 1] = {
    ...last,
    recheck: { at: at.toISOString(), by: by.trim(), passed, note: note.trim() },
  };

  if (passed) {
    return {
      ...record,
      entries,
      status: "已完成",
      frozenAt: at.toISOString(),
      resultNote: last.summary,
    };
  }
  return { ...record, entries, status: "待整改" };
}

/** 补写结果：仅冻结记录可用，必须留原因，改前内容自动留痕 */
export function amendResult(
  record: AnomalyRecord,
  by: string,
  reason: string,
  after: string,
  at = new Date()
): AnomalyRecord {
  if (record.status !== "已完成") throw new Error("只有已完成冻结的记录才需要补写结果");
  if (!by.trim()) throw new Error("请填写补写人");
  if (!reason.trim()) throw new Error("补写必须填写原因");
  if (!after.trim()) throw new Error("请填写补写后的内容");

  const amendment = {
    id: uid(),
    at: at.toISOString(),
    by: by.trim(),
    reason: reason.trim(),
    before: record.resultNote,
    after: after.trim(),
  };
  return {
    ...record,
    resultNote: after.trim(),
    amendments: [...record.amendments, amendment],
  };
}

// ---------- 交接班 ----------

/** 生成交接班单：复检未合格的区域不能交班；待办快照在生成时冻结 */
export function buildHandover(
  records: AnomalyRecord[],
  handovers: Handover[],
  shiftName: string,
  createdBy: string,
  at = new Date()
): Handover {
  const blocked = blockedAreas(records);
  if (blocked.length > 0) {
    throw new Error(`以下区域复检未合格，不能交班：${blocked.join("、")}`);
  }
  if (activeHandover(handovers)) {
    throw new Error("当前有未签收的交接单，请先完成签收");
  }
  if (!createdBy.trim()) throw new Error("请填写交班人");

  const pending: HandoverPendingItem[] = pendingRecords(records).map((r) => ({
    recordId: r.id,
    code: r.code,
    equipment: r.equipment,
    area: r.area,
    status: r.status,
    owner: r.owner,
    deadline: r.deadline,
  }));

  return {
    id: uid(),
    code: makeCode("JJ", at, handovers.length + 1),
    shiftName: shiftName.trim() || "未命名班次",
    createdAt: at.toISOString(),
    createdBy: createdBy.trim(),
    status: "待班长确认",
    pending,
    leader: null,
    confirmedAt: null,
    successor: null,
    signedAt: null,
  };
}

/** 班长确认待办 */
export function confirmHandover(handover: Handover, leader: string, at = new Date()): Handover {
  if (handover.status !== "待班长确认") throw new Error("当前交接单不在待确认状态");
  if (!leader.trim()) throw new Error("请填写班长姓名");
  return { ...handover, status: "待签收", leader: leader.trim(), confirmedAt: at.toISOString() };
}

/** 接班人签收，签收后交接单归档 */
export function signHandover(handover: Handover, successor: string, at = new Date()): Handover {
  if (handover.status !== "待签收") throw new Error("班长确认待办后才能签收");
  if (!successor.trim()) throw new Error("请填写接班人姓名");
  return { ...handover, status: "已签收", successor: successor.trim(), signedAt: at.toISOString() };
}
