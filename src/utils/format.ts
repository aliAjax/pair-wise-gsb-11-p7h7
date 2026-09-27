// ============ 页面层工具：展示用格式化 ============
import dayjs from "dayjs";

export function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = dayjs(iso);
  return d.isValid() ? d.format("YYYY-MM-DD HH:mm") : "—";
}

export function fmtDate(iso: string): string {
  const d = dayjs(iso);
  return d.isValid() ? d.format("YYYY-MM-DD") : iso;
}

export function deadlineText(deadline: string, open: boolean): string {
  if (!open) return deadline;
  const today = dayjs().format("YYYY-MM-DD");
  if (deadline < today) return `${deadline}（已逾期）`;
  if (deadline === today) return `${deadline}（今日到期）`;
  return deadline;
}
