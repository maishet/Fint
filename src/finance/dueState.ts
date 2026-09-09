import { parseDateString } from './dates'

/**
 * Cómo de cerca queda un vencimiento, en palabras. Lo comparten la lista de
 * pagos y los selectores de "aplicar a un pago" de los pendientes.
 */
export function getDueState(
  value: string | null | undefined,
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  const date = parseDateString(value);
  if (!date) return { overdue: false, label: t("debts.noDueDate") };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  const formatted = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  if (days < 0)
    return {
      overdue: true,
      label: t("debts.overdueDays", { days: Math.abs(days), date: formatted }),
    };
  if (days === 0) return { overdue: false, label: t("debts.dueToday") };
  return {
    overdue: false,
    label: t("debts.dueInDays", { days, date: formatted }),
  };
}
