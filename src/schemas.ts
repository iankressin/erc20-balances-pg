import { numeric, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core'

export const erc20Balances = pgTable(
  'erc20_balances',
  {
    holder: varchar({ length: 42 }).notNull(),
    token: varchar({ length: 42 }).notNull(),
    balance: numeric().notNull().default('0'),
  },
  (table) => [
    primaryKey({
      columns: [table.holder, table.token],
    }),
  ],
)

export default {
  erc20Balances,
}
