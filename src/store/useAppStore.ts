// ============ 页面与规则之间的应用状态（Zustand） ============
// 组件只调用这里的动作；动作内部调用纯规则函数，并通过存储层持久化。
import { create } from "zustand";
import type { AppData } from "../data/types";
import { loadData, resetData, saveData } from "./repository";
import {
  amendCompleted,
  confirmHandover,
  type RegisterInput,
  registerIssue,
  recheck,
  signHandover,
  submitRectification,
} from "../rules/engine";

interface AppState {
  data: AppData;
  register: (input: RegisterInput) => void;
  rectify: (issueId: string, input: { handler: string; action: string }) => void;
  doRecheck: (
    issueId: string,
    input: { checker: string; passed: boolean; note: string }
  ) => void;
  amend: (
    issueId: string,
    input: { author: string; reason: string; sceneNote?: string; owner?: string; deadline?: string }
  ) => void;
  confirmShift: (input: { outLeader: string; remark: string }) => void;
  signShift: (handoverId: string, input: { receiver: string }) => void;
  reset: () => void;
}

function commit(data: AppData): AppData {
  saveData(data);
  return data;
}

export const useAppStore = create<AppState>((set) => ({
  data: loadData(),
  register: (input) => set((s) => ({ data: commit(registerIssue(s.data, input)) })),
  rectify: (issueId, input) =>
    set((s) => ({ data: commit(submitRectification(s.data, issueId, input)) })),
  doRecheck: (issueId, input) =>
    set((s) => ({ data: commit(recheck(s.data, issueId, input)) })),
  amend: (issueId, input) =>
    set((s) => ({ data: commit(amendCompleted(s.data, issueId, input)) })),
  confirmShift: (input) =>
    set((s) => ({ data: commit(confirmHandover(s.data, input)) })),
  signShift: (handoverId, input) =>
    set((s) => ({ data: commit(signHandover(s.data, handoverId, input)) })),
  reset: () => set({ data: resetData() }),
}));
