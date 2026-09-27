// ============ 判定层：纯业务规则（无存储、无 DOM、无 React） ============
// 所有函数只接收数据并返回结果，便于测试与复用。
import {
  type AppData,
  type Area,
  type Device,
  type Handover,
  type HandoverItemSnapshot,
  type Issue,
  type IssueStatus,
  OPEN_STATUSES,
} from "../data/types";

export class RuleError extends Error {}

export const uid = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/** YYYY-MM-DD */
export function dateOnly(d: Date | string = new Date()): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isOverdue(issue: Pick<Issue, "status" | "deadline">): boolean {
  return OPEN_STATUSES.includes(issue.status) && issue.deadline < dateOnly();
}

// ---------- 登记异常 ----------
export interface RegisterInput {
  area: Area;
  deviceId: string;
  sceneNote: string;
  owner: string;
  deadline: string;
  recorder: string;
}

export function registerIssue(data: AppData, input: RegisterInput): AppData {
  const device = data.devices.find((d) => d.id === input.deviceId);
  if (!device) throw new RuleError("请选择设备");
  if (device.area !== input.area) throw new RuleError("设备与区域不匹配");
  if (!input.sceneNote.trim()) throw new RuleError("现场说明必须填写");
  if (!input.owner.trim()) throw new RuleError("责任人必须填写");
  if (!input.deadline) throw new RuleError("期限必须填写");
  if (!input.recorder.trim()) throw new RuleError("登记人必须填写");
  if (input.deadline < dateOnly()) throw new RuleError("期限不能早于今天");
  // 同一设备有未关闭异常时，不允许"覆盖式重报"：
  // 必须先把当前异常关闭（复检合格），再次出现才算"重复异常"并累加次数。
  if (device.openIssueId) {
    throw new RuleError(
      `该设备已有未关闭的异常单（${device.name}），请先完成整改与复检；复检后再次出现将自动记为重复异常。`
    );
  }

  const now = new Date().toISOString();
  // 重复异常：该设备历史上曾出现过异常 -> 沿用链 id；首次 -> 以自身为链首
  const prior = data.issues
    .filter((i) => i.deviceId === input.deviceId)
    .sort((a, b) => a.occurrenceNo - b.occurrenceNo);
  const chainId = prior[0]?.chainId ?? "";
  const occurrenceNo = device.occurrenceCount + 1;

  const issue: Issue = {
    id: uid("iss"),
    area: input.area,
    deviceId: input.deviceId,
    deviceName: device.name,
    occurrenceNo,
    chainId: chainId || "",
    status: "pending",
    sceneNote: input.sceneNote.trim(),
    owner: input.owner.trim(),
    deadline: input.deadline,
    createdAt: now,
    recorder: input.recorder.trim(),
    rectifications: [],
    rechecks: [],
    completedAt: null,
    amendments: [],
  };
  issue.chainId = chainId || issue.id;

  const devices = data.devices.map((d) =>
    d.id === input.deviceId
      ? {
          ...d,
          occurrenceCount: d.occurrenceCount + 1,
          rectificationCount: d.rectificationCount + 1,
          openIssueId: issue.id,
        }
      : d
  );
  return { ...data, devices, issues: [issue, ...data.issues] };
}

// ---------- 整改处理 ----------
export function submitRectification(
  data: AppData,
  issueId: string,
  input: { handler: string; action: string }
): AppData {
  if (!input.handler.trim()) throw new RuleError("整改人必须填写");
  if (!input.action.trim()) throw new RuleError("整改说明必须填写");
  const issue = data.issues.find((i) => i.id === issueId);
  if (!issue) throw new RuleError("异常单不存在");
  if (issue.status !== "pending" && issue.status !== "rework") {
    throw new RuleError("仅待整改/复检未过的异常可以提交整改");
  }
  const round = issue.rectifications.length + 1;
  const next: Issue = {
    ...issue,
    status: "recheck",
    rectifications: [
      ...issue.rectifications,
      {
        round,
        at: new Date().toISOString(),
        handler: input.handler.trim(),
        action: input.action.trim(),
      },
    ],
  };
  // 复检退回后的再次整改，设备累计整改次数 +1
  const addCount = issue.status === "rework";
  const devices = addCount
    ? data.devices.map((d) =>
        d.id === issue.deviceId
          ? { ...d, rectificationCount: d.rectificationCount + 1 }
          : d
      )
    : data.devices;
  return {
    ...data,
    devices,
    issues: data.issues.map((i) => (i.id === issueId ? next : i)),
  };
}

// ---------- 复检 ----------
export function recheck(
  data: AppData,
  issueId: string,
  input: { checker: string; passed: boolean; note: string }
): AppData {
  if (!input.checker.trim()) throw new RuleError("复检人必须填写");
  if (!input.note.trim()) throw new RuleError("复检意见必须填写");
  const issue = data.issues.find((i) => i.id === issueId);
  if (!issue) throw new RuleError("异常单不存在");
  if (issue.status !== "recheck") {
    throw new RuleError("仅待复检的异常可以执行复检");
  }
  const now = new Date().toISOString();
  const passed = input.passed;
  const next: Issue = {
    ...issue,
    status: (passed ? "done" : "rework") as IssueStatus,
    rechecks: [
      ...issue.rechecks,
      {
        at: now,
        checker: input.checker.trim(),
        passed,
        note: input.note.trim(),
      },
    ],
    completedAt: passed ? now : null,
  };
  const devices = passed
    ? data.devices.map((d) =>
        d.id === issue.deviceId ? { ...d, openIssueId: null } : d
      )
    : data.devices;
  return {
    ...data,
    devices,
    issues: data.issues.map((i) => (i.id === issueId ? next : i)),
  };
}

// ---------- 完成后补写/更正（记录冻结，留痕） ----------
export function amendCompleted(
  data: AppData,
  issueId: string,
  input: {
    author: string;
    reason: string;
    sceneNote?: string;
    owner?: string;
    deadline?: string;
  }
): AppData {
  if (!input.author.trim()) throw new RuleError("操作人必须填写");
  if (!input.reason.trim()) throw new RuleError("补写原因必须填写");
  const issue = data.issues.find((i) => i.id === issueId);
  if (!issue) throw new RuleError("异常单不存在");
  if (issue.status !== "done") {
    throw new RuleError("只有已完成（已冻结）的记录需要走补写/更正流程");
  }
  const patch: Partial<Issue> = {};
  if (input.sceneNote !== undefined && input.sceneNote.trim() && input.sceneNote !== issue.sceneNote) {
    patch.sceneNote = input.sceneNote.trim();
  }
  if (input.owner !== undefined && input.owner.trim() && input.owner !== issue.owner) {
    patch.owner = input.owner.trim();
  }
  if (input.deadline && input.deadline !== issue.deadline) {
    patch.deadline = input.deadline;
  }
  if (Object.keys(patch).length === 0) {
    throw new RuleError("内容与冻结时一致，没有可补写的变更");
  }
  const before = Object.fromEntries(
    Object.keys(patch).map((k) => [k, issue[k as keyof Issue]])
  ) as Partial<Issue>;
  const next: Issue = {
    ...issue,
    ...patch,
    amendments: [
      ...issue.amendments,
      {
        at: new Date().toISOString(),
        author: input.author.trim(),
        reason: input.reason.trim(),
        before,
        after: patch,
      },
    ],
  };
  return {
    ...data,
    issues: data.issues.map((i) => (i.id === issueId ? next : i)),
  };
}

// ---------- 交班判定 ----------
export function openIssues(data: AppData): Issue[] {
  return data.issues.filter((i) => OPEN_STATUSES.includes(i.status));
}

/** 复检没合格的异常（rework）所在区域 -> 该区域不能交班 */
export function blockedAreas(data: AppData): Area[] {
  const set = new Set<Area>();
  for (const issue of openIssues(data)) {
    if (issue.status === "rework") set.add(issue.area);
  }
  return [...set];
}

export interface HandoverPreview {
  items: HandoverItemSnapshot[];
  blockedAreas: Area[];
  /** 交班待办里是否含有受拦区域的条目 */
  hasBlockedItems: boolean;
}

export function previewHandover(data: AppData): HandoverPreview {
  const blocked = blockedAreas(data);
  const items: HandoverItemSnapshot[] = openIssues(data)
    .map((i) => ({
      issueId: i.id,
      area: i.area,
      deviceName: i.deviceName,
      status: i.status,
      owner: i.owner,
      deadline: i.deadline,
      occurrenceNo: i.occurrenceNo,
    }))
    .sort((a, b) => a.area.localeCompare(b.area, "zh-Hans-CN"));
  return {
    items,
    blockedAreas: blocked,
    hasBlockedItems: items.some((i) => blocked.includes(i.area)),
  };
}

export function confirmHandover(
  data: AppData,
  input: { outLeader: string; remark: string }
): AppData {
  if (!input.outLeader.trim()) throw new RuleError("交班班长必须填写");
  const active = data.handovers.find((h) => h.status === "awaiting_sign");
  if (active) throw new RuleError("已有待签收的交班单，请接班人签收后再交班");
  const preview = previewHandover(data);
  if (preview.hasBlockedItems) {
    throw new RuleError(
      `以下区域存在复检未合格项，不能交班：${preview.blockedAreas.join("、")}。请继续整改并复检合格。`
    );
  }
  const handover: Handover = {
    id: uid("ho"),
    createdAt: new Date().toISOString(),
    outLeader: input.outLeader.trim(),
    confirmedAt: new Date().toISOString(),
    receiver: null,
    signedAt: null,
    remark: input.remark.trim(),
    status: "awaiting_sign",
    items: preview.items,
    blockedAreas: [],
  };
  return { ...data, handovers: [handover, ...data.handovers] };
}

export function signHandover(
  data: AppData,
  handoverId: string,
  input: { receiver: string }
): AppData {
  if (!input.receiver.trim()) throw new RuleError("接班人必须签名");
  const handover = data.handovers.find((h) => h.id === handoverId);
  if (!handover) throw new RuleError("交班单不存在");
  if (handover.status !== "awaiting_sign") {
    throw new RuleError("该交班单已签收");
  }
  return {
    ...data,
    handovers: data.handovers.map((h) =>
      h.id === handoverId
        ? {
            ...h,
            receiver: input.receiver.trim(),
            signedAt: new Date().toISOString(),
            status: "signed",
          }
        : h
    ),
  };
}

// ---------- 查询：按设备 / 区域 / 状态 ----------
export interface IssueQuery {
  deviceId?: string; // 设备档案（可含历史全部异常）
  area?: Area | "all";
  status?: IssueStatus | "all";
  keyword?: string;
}

export function queryIssues(data: AppData, q: IssueQuery): Issue[] {
  return data.issues.filter((i) => {
    if (q.deviceId && i.deviceId !== q.deviceId) return false;
    if (q.area && q.area !== "all" && i.area !== q.area) return false;
    if (q.status && q.status !== "all" && i.status !== q.status) return false;
    if (q.keyword) {
      const kw = q.keyword.trim().toLowerCase();
      if (kw) {
        const hay = `${i.deviceName} ${i.owner} ${i.sceneNote} ${i.recorder}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
    }
    return true;
  });
}

/** 同一设备前后异常记录（按次数排序） */
export function deviceHistory(data: AppData, deviceId: string): Issue[] {
  return data.issues
    .filter((i) => i.deviceId === deviceId)
    .sort((a, b) => a.occurrenceNo - b.occurrenceNo || a.createdAt.localeCompare(b.createdAt));
}

export function getDevice(data: AppData, deviceId: string): Device | undefined {
  return data.devices.find((d) => d.id === deviceId);
}

export function metrics(data: AppData) {
  const open = openIssues(data).length;
  const rework = data.issues.filter((i) => i.status === "rework").length;
  const recheck = data.issues.filter((i) => i.status === "recheck").length;
  const overdue = data.issues.filter((i) => isOverdue(i)).length;
  const done = data.issues.filter((i) => i.status === "done").length;
  return { open, rework, recheck, overdue, done, total: data.issues.length };
}
