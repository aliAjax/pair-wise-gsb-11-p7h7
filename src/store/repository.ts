// ============ 存储层：localStorage 读写（不关心业务规则） ============
import type { AppData } from "../data/types";
import { buildSeedData } from "../data/seed";

const STORAGE_KEY = "gas-station-rectification-v1";

/** 读取数据；首次访问写入并返回种子数据，脏数据回退到安全空库 */
export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seed = buildSeedData();
    saveData(seed);
    return seed;
  }
  try {
    const parsed = JSON.parse(raw) as AppData;
    if (!parsed || !Array.isArray(parsed.issues) || !Array.isArray(parsed.devices)) {
      throw new Error("数据结构不完整");
    }
    return normalize(parsed);
  } catch (err) {
    console.error("本地数据解析失败，已重置为初始数据：", err);
    const seed = buildSeedData();
    saveData(seed);
    return seed;
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function resetData(): AppData {
  const seed = buildSeedData();
  saveData(seed);
  return seed;
}

/** 预留版本迁移入口；当前仅补齐版本号与可能缺失的集合 */
function normalize(data: AppData): AppData {
  return {
    version: data.version ?? 1,
    devices: data.devices ?? [],
    issues: data.issues ?? [],
    handovers: data.handovers ?? [],
  };
}
