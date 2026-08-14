import { z } from 'zod'

export const TransactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  type: z.enum(['income', 'expense', 'transfer']),
  amount: z.number(),
  currency: z.string(),
  category: z.string(),
  account: z.string(),
  note: z.string().optional(),
  paymentOccurrenceId: z.string().nullable().optional(),
  paymentOccurrencePaymentId: z.string().nullable().optional(),
  transferGroupId: z.string().nullable().optional(),
  transferDirection: z.enum(['origin', 'destination']).nullable().optional(),
})

export const AccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  accountType: z.string(),
  currency: z.string(),
  balance: z.number(),
})

export const TransactionListSchema = z.array(TransactionSchema)

export const AccountListSchema = z.array(AccountSchema)

export const AccountsOverviewSchema = z.object({
  currency: z.string(),
  currencies: z.array(z.string()),
  totals: z.object({
    assets: z.number(),
    liabilities: z.number(),
    netWorth: z.number(),
    count: z.number(),
  }),
  items: AccountListSchema,
})

const MonthFlowSchema = z.object({
  income: z.number(),
  expenses: z.number(),
  savings: z.number(),
})

export const DashboardOverviewSchema = z.object({
  currency: z.string(),
  netWorth: z.number(),
  accountCount: z.number(),
  currentMonth: MonthFlowSchema.extend({ month: z.number(), year: z.number() }),
  previousMonth: MonthFlowSchema,
  weeklyFlow: z.array(
    z.object({
      start: z.string(),
      end: z.string(),
      income: z.number(),
      expenses: z.number(),
    }),
  ),
  recentTransactions: TransactionListSchema,
})

export const TransactionPageSchema = z.object({
  summary: z.object({
    totalCount: z.number(),
    byCurrency: z.array(
      z.object({
        currency: z.string(),
        income: z.number(),
        expenses: z.number(),
        net: z.number(),
        count: z.number(),
      }),
    ),
  }),
  items: TransactionListSchema,
  pageInfo: z.object({
    hasNextPage: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
})
