// 状态层：Zustand 连接判定层与存储层，动作统一返回 { ok, message }

import { create } from "zustand";
import type { AnomalyRecord, Handover, PersistedState } from "./data/types";
import { loadState, saveState } from "./data/storage";
import * as rules from "./domain/rules";

export interface ActionResult {
  ok: boolean;
  message: string;
}

interface StoreState extends PersistedState {
  registerAnomaly: (input: rules.RegisterInput) => ActionResult;
  submitRectification: (recordId: string, by: string, summary: string) => ActionResult;
  recheckRectification: (recordId: string, passed: boolean, by: string, note: string) => ActionResult;
  amendResult: (recordId: string, by: string, reason: string, after: string) => ActionResult;
  createHandover: (shiftName: string, createdBy: string) => ActionResult;
  confirmHandover: (id: string, leader: string) => ActionResult;
  signHandover: (id: string, successor: string) => ActionResult;
}

const ok = (message = ""): ActionResult => ({ ok: true, message });
const fail = (e: unknown): ActionResult => ({
  ok: false,
  message: e instanceof Error ? e.message : String(e),
});

export const useStore = create<StoreState>((set, get) => {
  const persist = (records: AnomalyRecord[], handovers: Handover[]) => {
    set({ records, handovers });
    saveState({ records, handovers });
  };

  const mutateRecord = (id: string, fn: (r: AnomalyRecord) => AnomalyRecord): ActionResult => {
    try {
      const records = get().records.map((r) => (r.id === id ? fn(r) : r));
      persist(records, get().handovers);
      return ok();
    } catch (e) {
      return fail(e);
    }
  };

  const mutateHandover = (id: string, fn: (h: Handover) => Handover): ActionResult => {
    try {
      const handovers = get().handovers.map((h) => (h.id === id ? fn(h) : h));
      persist(get().records, handovers);
      return ok();
    } catch (e) {
      return fail(e);
    }
  };

  return {
    ...loadState(),

    registerAnomaly: (input) => {
      try {
        const before = get().records;
        const record = rules.registerAnomaly(before, input);
        const next = [record, ...before];
        persist(next, get().handovers);
        const occurrence = rules.occurrenceIndex(next, record);
        const total = rules.equipmentRectificationTotal(next, record.equipment);
        return ok(
          occurrence > 1
            ? `已登记 ${record.code}：「${record.equipment}」第 ${occurrence} 次异常，已关联上一条记录，设备累计整改 ${total} 次`
            : `已登记 ${record.code}`
        );
      } catch (e) {
        return fail(e);
      }
    },

    submitRectification: (recordId, by, summary) =>
      mutateRecord(recordId, (r) => rules.submitRectification(r, by, summary)),

    recheckRectification: (recordId, passed, by, note) =>
      mutateRecord(recordId, (r) => rules.recheckRectification(r, passed, by, note)),

    amendResult: (recordId, by, reason, after) =>
      mutateRecord(recordId, (r) => rules.amendResult(r, by, reason, after)),

    createHandover: (shiftName, createdBy) => {
      try {
        const handover = rules.buildHandover(get().records, get().handovers, shiftName, createdBy);
        persist(get().records, [handover, ...get().handovers]);
        return ok(`交接单 ${handover.code} 已生成，待班长确认 ${handover.pending.length} 项待办`);
      } catch (e) {
        return fail(e);
      }
    },

    confirmHandover: (id, leader) =>
      mutateHandover(id, (h) => rules.confirmHandover(h, leader)),

    signHandover: (id, successor) =>
      mutateHandover(id, (h) => rules.signHandover(h, successor)),
  };
});
