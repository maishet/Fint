import type { FinancialReport } from "../api/types";
import { fintPalette } from "../theme/palette";
import * as XLSX from "xlsx";

const rgba = (hex: string, alpha: number) =>
  `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${alpha})`;

const COLORS = {
  ...fintPalette.light,
  groundAccentSoft: rgba(fintPalette.light.groundAccent, 0.28),
} as const;

export interface ReportExportLabels {
  title: string;
  closing: string;
  generated: string;
  period: string;
  executiveSummary: string;
  financialStatus: string;
  income: string;
  expenses: string;
  net: string;
  savingsRate: string;
  transactions: string;
  previousPeriod: string;
  flow: string;
  categories: string;
  accountActivity: string;
  currentPosition: string;
  accounts: string;
  debts: string;
  topTransactions: string;
  category: string;
  account: string;
  date: string;
  type: string;
  amount: string;
  balance: string;
  outstanding: string;
  dueDate: string;
  progress: string;
  noData: string;
  currentSnapshotNote: string;
  statuses: Record<FinancialReport["summary"]["status"], string>;
  statusMessages: Record<FinancialReport["summary"]["status"], string>;
  accountTypes: Record<string, string>;
  incomeType: string;
  expenseType: string;
}

export interface ReportExportOptions {
  labels: ReportExportLabels;
  locale: string;
}

export function buildReportXlsx(
  report: FinancialReport,
  options: ReportExportOptions,
) {
  const workbook = buildReportWorkbook(report, options);
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Uint8Array(output);
}

export function buildReportWorkbook(
  report: FinancialReport,
  { labels, locale }: ReportExportOptions,
) {
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, "Resumen", [
    [labels.title],
    [labels.period, formatPeriod(report, locale)],
    [labels.generated, formatDateTime(report.generatedAt, locale)],
    [],
    [labels.executiveSummary],
    [labels.income, report.summary.income],
    [labels.expenses, report.summary.expenses],
    [labels.net, report.summary.net],
    [labels.savingsRate, report.summary.savingsRate],
    [labels.transactions, report.summary.transactionCount],
    [labels.financialStatus, labels.statuses[report.summary.status]],
  ]);
  addSheet(workbook, "Flujo", [
    [labels.period, labels.income, labels.expenses, labels.net, labels.transactions],
    ...report.series.map((item) => [
      item.period,
      item.income,
      item.expenses,
      item.net,
      item.transactionCount,
    ]),
  ]);
  addSheet(workbook, "Categorías", [
    [labels.category, labels.amount, "%", labels.previousPeriod, labels.transactions],
    ...report.categories.map((item) => [
      `${item.icon ?? ""} ${item.name}`.trim(),
      item.amount,
      item.percentage,
      item.previousAmount,
      item.transactionCount,
    ]),
  ]);
  addSheet(workbook, "Cuentas", [
    [labels.account, labels.type, labels.income, labels.expenses, labels.net, labels.transactions],
    ...report.accountActivity.map((item) => [
      item.name,
      labels.accountTypes[item.accountType] ?? item.accountType,
      item.income,
      item.expenses,
      item.net,
      item.transactionCount,
    ]),
    [],
    [labels.currentPosition],
    [labels.account, labels.type, labels.balance],
    ...report.currentPosition.accounts.map((item) => [
      item.name,
      labels.accountTypes[item.accountType] ?? item.accountType,
      item.balance,
    ]),
  ]);
  addSheet(workbook, "Movimientos", [
    [labels.date, labels.type, labels.category, labels.account, labels.amount],
    ...report.topTransactions.map((item) => [
      item.date,
      item.type === "income" ? labels.incomeType : labels.expenseType,
      item.category,
      item.account,
      item.amount,
    ]),
  ]);
  addSheet(workbook, "Pagos", [
    [labels.debts, labels.account, labels.outstanding, labels.amount, labels.dueDate, labels.progress],
    ...report.currentPosition.debts.map((item) => [
      item.description,
      item.account,
      item.outstanding,
      item.originalAmount,
      item.dueDate,
      item.paidPercentage,
    ]),
  ]);
  return workbook;
}

export function buildReportHtml(
  report: FinancialReport,
  { labels, locale }: ReportExportOptions,
) {
  const currency = report.filters.currency;
  const money = (value: number) => formatMoney(value, currency, locale);
  const status = labels.statuses[report.summary.status];
  const endDate = previousDay(report.period.to);
  const categoryRows = report.categories
    .map(
      (item) =>
        `<tr><td><span class="emoji">${escapeHtml(item.icon ?? "•")}</span>${escapeHtml(item.name)}</td><td class="num">${item.percentage}%</td><td class="num">${money(item.previousAmount)}</td><td class="num strong">${money(item.amount)}</td></tr>`,
    )
    .join("");
  const accountRows = report.accountActivity
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}<small>${escapeHtml(labels.accountTypes[item.accountType] ?? item.accountType)}</small></td><td class="num">${item.transactionCount}</td><td class="num income">${money(item.income)}</td><td class="num expense">${money(item.expenses)}</td><td class="num strong">${money(item.net)}</td></tr>`,
    )
    .join("");
  const balanceRows = report.currentPosition.accounts
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.name)}<small>${escapeHtml(labels.accountTypes[item.accountType] ?? item.accountType)}</small></td><td>${escapeHtml(item.currency)}</td><td class="num strong">${money(item.balance)}</td></tr>`,
    )
    .join("");
  const debtRows = report.currentPosition.debts
    .map(
      (item) =>
        `<tr><td>${escapeHtml(item.description)}<small>${escapeHtml(item.account)}</small></td><td>${item.dueDate ? formatDate(item.dueDate, locale) : "-"}</td><td class="num">${item.paidPercentage}%</td><td class="num strong">${money(item.outstanding)}</td></tr>`,
    )
    .join("");
  const transactionRows = report.topTransactions
    .map(
      (item, index) =>
        `<tr><td>${index + 1}</td><td>${formatDate(item.date, locale)}</td><td><span class="type ${item.type}">${escapeHtml(item.type === "income" ? labels.incomeType : labels.expenseType)}</span></td><td>${escapeHtml(item.category)}<small>${escapeHtml(item.account)}</small></td><td class="num strong">${money(item.amount)}</td></tr>`,
    )
    .join("");
  const chart = buildFlowChart(report);
  const categoryBars = report.categories
    .slice(0, 7)
    .map(
      (item) =>
        `<div class="category-bar"><div><span>${escapeHtml(item.icon ?? "•")} ${escapeHtml(item.name)}</span><strong>${money(item.amount)}</strong></div><div class="track"><i style="width:${Math.max(2, item.percentage)}%"></i></div></div>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; } * { box-sizing: border-box; } body { margin: 0; color: ${COLORS.text}; font-family: Inter, Arial, sans-serif; font-size: 10.5px; line-height: 1.42; }
    .page { min-height: 297mm; padding: 18mm 17mm 15mm; position: relative; page-break-after: always; } .page:last-child { page-break-after: auto; }
    .cover { background: linear-gradient(145deg, ${COLORS.ground} 0%, ${COLORS.primaryStrong} 62%, ${COLORS.primary} 100%); color: ${COLORS.groundForeground}; padding-top: 25mm; } .brand { color: ${COLORS.groundAccent}; font-size: 12px; font-weight: 800; letter-spacing: 2.4px; text-transform: uppercase; }
    .cover h1 { font-size: 34px; line-height: 1.05; margin: 22mm 0 5mm; max-width: 145mm; } .cover .period { color: ${COLORS.groundMuted}; font-size: 15px; } .cover-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; margin-top: 18mm; }
    .cover-card { background: rgba(255,255,255,.09); border: 1px solid ${COLORS.groundAccentSoft}; border-radius: 12px; padding: 5mm; } .cover-card small { color: ${COLORS.groundMuted}; display: block; margin-bottom: 2mm; } .cover-card strong { display: block; font-size: 20px; }
    .status { margin-top: 8mm; background: ${COLORS.surface}; border-radius: 14px; color: ${COLORS.text}; padding: 6mm; } .status-kicker { color: ${COLORS.primaryStrong}; font-size: 9px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; } .status h2 { border: 0; margin: 2mm 0; padding: 0; font-size: 18px; } .status p { color: ${COLORS.muted}; margin: 0; } .highlights { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 5mm; } .highlight { border-top: 1px solid ${COLORS.border}; padding-top: 3mm; } .highlight small { color: ${COLORS.muted}; display: block; } .highlight strong { color: ${COLORS.primaryStrong}; display: block; margin-top: 1mm; }
    .page-header { border-bottom: 2px solid ${COLORS.border}; display: flex; justify-content: space-between; margin-bottom: 7mm; padding-bottom: 3mm; } .page-header span { color: ${COLORS.primaryStrong}; font-weight: 800; letter-spacing: .8px; text-transform: uppercase; } .page-header small { color: ${COLORS.muted}; }
    h2 { color: ${COLORS.text}; font-size: 18px; margin: 0 0 4mm; } h3 { color: ${COLORS.primaryStrong}; font-size: 13px; margin: 6mm 0 3mm; }
    .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 3mm; margin-bottom: 7mm; } .metric { border: 1px solid ${COLORS.border}; border-radius: 10px; padding: 4mm; } .metric small { color: ${COLORS.muted}; display: block; min-height: 8mm; } .metric strong { color: ${COLORS.text}; display: block; font-size: 15px; } .metric.income strong { color: ${COLORS.success}; } .metric.expense strong { color: ${COLORS.danger}; }
    .panel { border: 1px solid ${COLORS.border}; border-radius: 12px; padding: 5mm; margin-bottom: 6mm; break-inside: avoid; } .note { background: ${COLORS.subtle}; border-left: 4px solid ${COLORS.primary}; border-radius: 7px; color: ${COLORS.muted}; margin-bottom: 4mm; padding: 4mm; }
    .chart { width: 100%; height: 62mm; } .chart text { fill: ${COLORS.muted}; font-size: 8px; } .chart .income-bar { fill: ${COLORS.success}; } .chart .expense-bar { fill: ${COLORS.danger}; } .chart .axis { stroke: ${COLORS.border}; stroke-width: 1; }
    .category-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm 7mm; } .category-bar div:first-child { display: flex; justify-content: space-between; margin-bottom: 1.5mm; } .category-bar strong { color: ${COLORS.text}; } .track { background: ${COLORS.subtle}; border-radius: 8px; height: 5px; overflow: hidden; } .track i { background: ${COLORS.primary}; display: block; height: 100%; }
    table { border-collapse: collapse; width: 100%; } thead { display: table-header-group; } tr { break-inside: avoid; } th { background: ${COLORS.subtle}; color: ${COLORS.primaryStrong}; font-size: 9px; letter-spacing: .3px; padding: 2.7mm 2mm; text-align: left; text-transform: uppercase; } td { border-bottom: 1px solid ${COLORS.border}; padding: 2.7mm 2mm; } td small { color: ${COLORS.muted}; display: block; font-size: 8px; } .num { text-align: right; } .strong { color: ${COLORS.text}; font-weight: 800; } .income { color: ${COLORS.success}; } .expense { color: ${COLORS.danger}; }
    .position-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-bottom: 6mm; } .position { background: ${COLORS.subtle}; border-radius: 10px; padding: 4mm; } .position small { color: ${COLORS.muted}; display: block; } .position strong { color: ${COLORS.text}; display: block; font-size: 15px; margin-top: 1mm; }
    .type { border-radius: 10px; display: inline-block; font-size: 8px; font-weight: 800; padding: 1mm 2mm; } .type.income { background: ${COLORS.elevated}; } .type.expense { background: ${COLORS.subtle}; }
    .footer { bottom: 8mm; color: ${COLORS.muted}; display: flex; font-size: 8px; justify-content: space-between; left: 17mm; position: absolute; right: 17mm; } .empty { color: ${COLORS.muted}; padding: 8mm; text-align: center; }
  </style></head><body>
    <section class="page cover"><div class="brand">My Fint · ${escapeHtml(labels.closing)}</div><h1>${escapeHtml(labels.title)}</h1><div class="period">${formatDate(report.period.from, locale)} - ${formatDate(endDate, locale)} · ${escapeHtml(currency)}</div>
      <div class="cover-grid"><div class="cover-card"><small>${escapeHtml(labels.income)}</small><strong>${money(report.summary.income)}</strong></div><div class="cover-card"><small>${escapeHtml(labels.expenses)}</small><strong>${money(report.summary.expenses)}</strong></div><div class="cover-card"><small>${escapeHtml(labels.net)}</small><strong>${money(report.summary.net)}</strong></div><div class="cover-card"><small>${escapeHtml(labels.transactions)}</small><strong>${report.summary.transactionCount}</strong></div></div>
      <div class="status"><div class="status-kicker">${escapeHtml(labels.financialStatus)}</div><h2>${escapeHtml(status)}</h2><p>${escapeHtml(labels.statusMessages[report.summary.status])}</p><div class="highlights"><div class="highlight"><small>${escapeHtml(labels.categories)}</small><strong>${report.highlights.topExpenseCategory ? `${escapeHtml(report.highlights.topExpenseCategory.name)} · ${money(report.highlights.topExpenseCategory.amount)}` : escapeHtml(labels.noData)}</strong></div><div class="highlight"><small>${escapeHtml(labels.topTransactions)}</small><strong>${report.highlights.largestTransaction ? `${escapeHtml(report.highlights.largestTransaction.category)} · ${money(report.highlights.largestTransaction.amount)}` : escapeHtml(labels.noData)}</strong></div></div></div><div class="footer"><span>My Fint</span><span>${escapeHtml(labels.generated)} ${formatDateTime(report.generatedAt, locale)}</span></div></section>
    <section class="page"><div class="page-header"><span>${escapeHtml(labels.flow)}</span><small>My Fint · 02</small></div><h2>${escapeHtml(labels.executiveSummary)}</h2><div class="metrics"><div class="metric income"><small>${escapeHtml(labels.income)}</small><strong>${money(report.summary.income)}</strong></div><div class="metric expense"><small>${escapeHtml(labels.expenses)}</small><strong>${money(report.summary.expenses)}</strong></div><div class="metric"><small>${escapeHtml(labels.net)}</small><strong>${money(report.summary.net)}</strong></div><div class="metric"><small>${escapeHtml(labels.savingsRate)}</small><strong>${report.summary.savingsRate === null ? "-" : `${report.summary.savingsRate}%`}</strong></div></div><div class="panel">${chart}</div><h3>${escapeHtml(labels.categories)}</h3><div class="panel"><div class="category-grid">${categoryBars || `<div class="empty">${escapeHtml(labels.noData)}</div>`}</div></div><table><thead><tr><th>${escapeHtml(labels.category)}</th><th class="num">%</th><th class="num">${escapeHtml(labels.previousPeriod)}</th><th class="num">${escapeHtml(labels.amount)}</th></tr></thead><tbody>${categoryRows || `<tr><td colspan="4" class="empty">${escapeHtml(labels.noData)}</td></tr>`}</tbody></table><div class="footer"><span>${escapeHtml(labels.title)}</span><span>02</span></div></section>
    <section class="page"><div class="page-header"><span>${escapeHtml(labels.accountActivity)}</span><small>My Fint · 03</small></div><h2>${escapeHtml(labels.accountActivity)}</h2><table><thead><tr><th>${escapeHtml(labels.account)}</th><th class="num">${escapeHtml(labels.transactions)}</th><th class="num">${escapeHtml(labels.income)}</th><th class="num">${escapeHtml(labels.expenses)}</th><th class="num">${escapeHtml(labels.net)}</th></tr></thead><tbody>${accountRows || `<tr><td colspan="5" class="empty">${escapeHtml(labels.noData)}</td></tr>`}</tbody></table><h3>${escapeHtml(labels.currentPosition)}</h3><div class="note">${escapeHtml(labels.currentSnapshotNote)}</div><div class="position-grid"><div class="position"><small>${escapeHtml(labels.balance)}</small><strong>${money(report.currentPosition.totalAccountBalance)}</strong></div><div class="position"><small>${escapeHtml(labels.outstanding)}</small><strong>${money(report.currentPosition.totalDebtOutstanding)}</strong></div><div class="position"><small>${escapeHtml(labels.net)}</small><strong>${money(report.currentPosition.netPosition)}</strong></div></div><table><thead><tr><th>${escapeHtml(labels.accounts)}</th><th>${escapeHtml(labels.type)}</th><th class="num">${escapeHtml(labels.balance)}</th></tr></thead><tbody>${balanceRows || `<tr><td colspan="3" class="empty">${escapeHtml(labels.noData)}</td></tr>`}</tbody></table><div class="footer"><span>${escapeHtml(labels.title)}</span><span>03</span></div></section>
    <section class="page"><div class="page-header"><span>${escapeHtml(labels.topTransactions)}</span><small>My Fint · 04</small></div><h2>${escapeHtml(labels.topTransactions)}</h2><table><thead><tr><th>#</th><th>${escapeHtml(labels.date)}</th><th>${escapeHtml(labels.type)}</th><th>${escapeHtml(labels.category)}</th><th class="num">${escapeHtml(labels.amount)}</th></tr></thead><tbody>${transactionRows || `<tr><td colspan="5" class="empty">${escapeHtml(labels.noData)}</td></tr>`}</tbody></table><h3>${escapeHtml(labels.debts)}</h3><table><thead><tr><th>${escapeHtml(labels.debts)}</th><th>${escapeHtml(labels.dueDate)}</th><th class="num">${escapeHtml(labels.progress)}</th><th class="num">${escapeHtml(labels.outstanding)}</th></tr></thead><tbody>${debtRows || `<tr><td colspan="4" class="empty">${escapeHtml(labels.noData)}</td></tr>`}</tbody></table><div class="footer"><span>${escapeHtml(labels.title)}</span><span>04</span></div></section>
  </body></html>`;
}

function buildFlowChart(report: FinancialReport) {
  if (report.series.length === 0) return '<div class="empty">-</div>';
  const width = 680;
  const height = 220;
  const baseline = 185;
  const max = Math.max(
    1,
    ...report.series.flatMap((item) => [item.income, item.expenses]),
  );
  const groupWidth = width / report.series.length;
  const bars = report.series
    .map((item, index) => {
      const incomeHeight = Math.round((item.income / max) * 140);
      const expenseHeight = Math.round((item.expenses / max) * 140);
      const x = index * groupWidth + groupWidth / 2 - 14;
      return `<rect class="income-bar" x="${x}" y="${baseline - incomeHeight}" width="11" height="${incomeHeight}" rx="3"/><rect class="expense-bar" x="${x + 16}" y="${baseline - expenseHeight}" width="11" height="${expenseHeight}" rx="3"/><text x="${index * groupWidth + groupWidth / 2}" y="205" text-anchor="middle">${escapeHtml(item.period.slice(5))}</text>`;
    })
    .join("");
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><line class="axis" x1="0" x2="${width}" y1="${baseline}" y2="${baseline}"/>${bars}</svg>`;
}

export function reportFileName(
  report: FinancialReport,
  extension: "pdf" | "xlsx",
) {
  return `fint-cierre-${report.period.from}-${previousDay(report.period.to)}.${extension}`;
}

function addSheet(workbook: XLSX.WorkBook, name: string, rows: Array<Array<string | number | null | undefined>>) {
  const sheet = XLSX.utils.aoa_to_sheet(rows.map((row) => row.map(xlsxCell)));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function xlsxCell(value: string | number | null | undefined) {
  if (typeof value !== "string") return value ?? null;
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function formatPeriod(report: FinancialReport, locale: string) {
  return `${formatDate(report.period.from, locale)} - ${formatDate(previousDay(report.period.to), locale)}`;
}

function previousDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
    maximumFractionDigits: 2,
  }).format(value);
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}
