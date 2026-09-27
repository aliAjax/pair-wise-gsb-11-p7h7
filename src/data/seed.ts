// 数据层：首次启动的种子数据，演示完整闭环（冻结记录、重复异常、复检不合格、已签收交接单）

import type { AnomalyRecord, Handover, PersistedState } from "./types";

const iso = (day: string) => new Date(`${day}T08:00:00`).toISOString();

const records: AnomalyRecord[] = [
  {
    id: "seed-r-004",
    code: "ZG-20260927-004",
    equipment: "收银台扫码枪",
    area: "收银区",
    description: "扫码枪间歇性断连，高峰时段影响收银",
    owner: "赵敏",
    deadline: "2026-09-29",
    reporter: "赵敏",
    createdAt: iso("2026-09-27"),
    status: "待复检",
    entries: [
      { id: "seed-e-004", at: iso("2026-09-27"), by: "赵敏", summary: "更换数据线并固定接口", recheck: null },
    ],
    amendments: [],
    prevRecordId: null,
    resultNote: "",
    frozenAt: null,
  },
  {
    id: "seed-r-003",
    code: "ZG-20260926-003",
    equipment: "卸油口密封",
    area: "油罐区",
    description: "卸油口密封圈老化，关闭后仍有油气味",
    owner: "李工",
    deadline: "2026-09-26",
    reporter: "王强",
    createdAt: iso("2026-09-26"),
    status: "待整改",
    entries: [
      {
        id: "seed-e-003",
        at: iso("2026-09-26"),
        by: "李工",
        summary: "更换密封圈",
        recheck: { at: iso("2026-09-26"), by: "王强", passed: false, note: "仍有渗漏，需更换法兰垫片" },
      },
    ],
    amendments: [],
    prevRecordId: null,
    resultNote: "",
    frozenAt: null,
  },
  {
    id: "seed-r-002",
    code: "ZG-20260925-002",
    equipment: "加油机1号",
    area: "加油区",
    description: "显示屏黑屏，重启后恢复，疑似电源板接触不良",
    owner: "何鑫",
    deadline: "2026-09-28",
    reporter: "刘洋",
    createdAt: iso("2026-09-25"),
    status: "待整改",
    entries: [],
    amendments: [],
    prevRecordId: "seed-r-001",
    resultNote: "",
    frozenAt: null,
  },
  {
    id: "seed-r-001",
    code: "ZG-20260920-001",
    equipment: "加油机1号",
    area: "加油区",
    description: "3号加油枪提枪后渗油，地面有油渍",
    owner: "何鑫",
    deadline: "2026-09-22",
    reporter: "王强",
    createdAt: iso("2026-09-20"),
    status: "已完成",
    entries: [
      {
        id: "seed-e-001",
        at: iso("2026-09-20"),
        by: "何鑫",
        summary: "更换加油枪密封圈，清理现场油渍",
        recheck: { at: iso("2026-09-21"), by: "王强", passed: true, note: "试机无渗漏，复检合格" },
      },
    ],
    amendments: [
      {
        id: "seed-a-001",
        at: iso("2026-09-22"),
        by: "王强",
        reason: "补记试机时长，便于追溯",
        before: "更换加油枪密封圈，清理现场油渍",
        after: "更换加油枪密封圈，清理现场油渍；试机30分钟无渗漏",
      },
    ],
    prevRecordId: null,
    resultNote: "更换加油枪密封圈，清理现场油渍；试机30分钟无渗漏",
    frozenAt: iso("2026-09-21"),
  },
];

const handovers: Handover[] = [
  {
    id: "seed-h-001",
    code: "JJ-20260925-001",
    shiftName: "夜班交接",
    createdAt: iso("2026-09-25"),
    createdBy: "王强",
    status: "已签收",
    pending: [
      {
        recordId: "seed-r-002",
        code: "ZG-20260925-002",
        equipment: "加油机1号",
        area: "加油区",
        status: "待整改",
        owner: "何鑫",
        deadline: "2026-09-28",
      },
    ],
    leader: "王强",
    confirmedAt: iso("2026-09-25"),
    successor: "刘洋",
    signedAt: iso("2026-09-25"),
  },
];

export function seedState(): PersistedState {
  return { records, handovers };
}
