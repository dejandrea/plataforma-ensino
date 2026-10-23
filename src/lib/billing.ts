export type BillingPlan = {
  id: string; billing_mode: "prepaid" | "postpaid"; effective_month: string;
  due_day: number; monthly_lessons: number; monthly_price: number; package_id: string | null;
};
export type BillingInvoice = {
  id: string; student_id: string; student_name?: string; reference_month: string;
  billing_mode: "prepaid" | "postpaid"; kind: "monthly" | "topup"; lesson_quantity: number;
  due_date: string; gross_amount: number; discount_amount: number; paid_total: number;
  outstanding: number; overdue_days: number; is_draft: boolean; pricing_missing?: boolean;
  last_paid_on: string | null;
  discount_override?:{name:string;kind:'fixed'|'percentage';value:number;discountId:string|null}|null;
};
export type BillingPayment = { id: string; invoice_id: string; amount: number; paid_on: string; voided_at: string | null };
export type StudentBilling = {
  plan: BillingPlan | null; plans: BillingPlan[]; credits: number; consumed: number;
  remaining: number; overage: number; overdue_blocked: boolean; balance_blocked: boolean;
  invoices: BillingInvoice[]; payments: BillingPayment[];
};
export const billingModeLabel = (mode: string) => mode === "prepaid" ? "Pré-pago" : "Pós-pago";
export const invoiceStatus = (row: BillingInvoice) => row.is_draft ? "Em apuração"
  : row.pricing_missing ? "Preço a definir"
    : Number(row.outstanding) <= 0 ? "Pago"
      : row.overdue_days > 15 ? "Atraso superior a 15 dias"
        : row.overdue_days > 0 ? "Em atraso" : "Pendente";
export const dateLabel = (date?: string | null) => date ? date.slice(0, 10).split("-").reverse().join("/") : "—";
export const todayInBahia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const nextBillingMonth = (month: string) => {
  const [year, value] = month.split("-").map(Number);
  return `${year + (value === 12 ? 1 : 0)}-${String(value === 12 ? 1 : value + 1).padStart(2, "0")}`;
};
