export type DiscountKind = "percentage" | "fixed";

export type CommercialDiscount = {
  id: string;
  name: string;
  kind: DiscountKind;
  value: number | string;
  is_active: boolean;
};

export type StudentDiscount = {
  id: string;
  student_id: string;
  scope: "recurring" | "monthly";
  effective_month: string;
  discount_id: string | null;
  name: string;
  kind: DiscountKind;
  value: number | string;
};

export const money = (value: number) => value.toLocaleString("pt-BR", {
  style: "currency", currency: "BRL",
});

export const normalizeHourlyRate = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 ? rate : null;
};

export const currentMonth = () => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bahia", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
};

export const lessonMonth = (date: string) => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "America/Bahia", year: "numeric", month: "2-digit",
  }).formatToParts(new Date(date));
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
};

export const discountLabel = (discount: Pick<CommercialDiscount, "kind" | "value">) =>
  discount.kind === "percentage" ? `${Number(discount.value)}%` : money(Number(discount.value));

export const effectiveDiscount = (rows: StudentDiscount[], studentId: string, month: string) => {
  const candidates = rows.filter((row) => row.student_id === studentId);
  return candidates.find((row) => row.scope === "monthly" && row.effective_month.slice(0, 7) === month)
    || candidates.filter((row) => row.scope === "recurring" && row.effective_month.slice(0, 7) <= month)
      .sort((a, b) => b.effective_month.localeCompare(a.effective_month))[0];
};

// Round monetary values in cents and never produce negative balances.
export const calculateDiscount = (gross: number, discount?: Pick<StudentDiscount, "kind" | "value">) => {
  const grossCents = Math.max(0, Math.round(gross * 100));
  const value = Number(discount?.value || 0);
  const discountCents = !Number.isFinite(value) || value < 0 ? 0
    : discount?.kind === "percentage" ? Math.round(grossCents * Math.min(value, 100) / 100)
      : Math.round(value * 100);
  const applied = Math.min(grossCents, discountCents);
  return { gross: grossCents / 100, discount: applied / 100, net: (grossCents - applied) / 100 };
};

export const calculateStudentTotal = (
  studentId: string,
  lessons: { starts_at: string; ends_at: string }[],
  hourlyRate: number,
  discounts: StudentDiscount[],
) => {
  const byMonth = new Map<string, number>();
  for (const lesson of lessons) {
    const month = lessonMonth(lesson.starts_at);
    const hours = Math.max(0, (new Date(lesson.ends_at).getTime() - new Date(lesson.starts_at).getTime()) / 3_600_000);
    byMonth.set(month, (byMonth.get(month) || 0) + hours * hourlyRate);
  }
  const months = [...byMonth].sort(([a], [b]) => a.localeCompare(b)).map(([month, gross]) => {
    const applied = effectiveDiscount(discounts, studentId, month);
    return { month, applied, ...calculateDiscount(gross, applied) };
  });
  return {
    months,
    gross: months.reduce((sum, row) => sum + Math.round(row.gross * 100), 0) / 100,
    discount: months.reduce((sum, row) => sum + Math.round(row.discount * 100), 0) / 100,
    net: months.reduce((sum, row) => sum + Math.round(row.net * 100), 0) / 100,
  };
};
