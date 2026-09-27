// 存储层：localStorage 持久化，重开后数据不丢

import type { PersistedState } from "./types";
import { seedState } from "./seed";

export const STORAGE_KEY = "dfwlfront-10-handover-v1";

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as PersistedState;
    if (!Array.isArray(parsed.records) || !Array.isArray(parsed.handovers)) {
      return seedState();
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时保留内存态，不阻断操作
  }
}
