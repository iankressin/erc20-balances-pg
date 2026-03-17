import 'dotenv/config'
import { commonAbis, evmDecoder, evmPortalSource } from '@subsquid/pipes/evm'
import { drizzleTarget } from '@subsquid/pipes/targets/drizzle/node-postgres'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { erc20Balances } from './schemas.js'

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const erc20Transfers = evmDecoder({
  range: { from: 'latest' },
  events: {
    transfers: commonAbis.erc20.events.Transfer,
  },
}).pipe(({ transfers }) =>
  transfers.map((t) => ({
    from: t.event.from,
    to: t.event.to,
    value: t.event.value,
    token: t.contract,
  })),
)

export async function main() {
  await evmPortalSource({
    portal: 'https://portal.sqd.dev/datasets/ethereum-mainnet',
  })
    .pipeComposite({
      erc20Transfers,
    })
    .pipeTo(
      drizzleTarget({
        db: drizzle(
          process.env.DB_CONNECTION_STR ??
            (() => {
              throw new Error('DB_CONNECTION_STR env missing')
            })(),
        ),
        tables: [erc20Balances],
        onData: async ({ tx, data }) => {
          // Aggregate deltas per (holder, token) within this batch
          const deltas = new Map<string, bigint>()

          for (const transfer of data.erc20Transfers) {
            const { from, to, value, token } = transfer

            if (from !== ZERO_ADDRESS) {
              const key = `${from}:${token}`
              deltas.set(key, (deltas.get(key) ?? 0n) - value)
            }

            if (to !== ZERO_ADDRESS) {
              const key = `${to}:${token}`
              deltas.set(key, (deltas.get(key) ?? 0n) + value)
            }
          }

          // Upsert each aggregated delta
          for (const [key, delta] of deltas) {
            const [holder, token] = key.split(':')
            await tx
              .insert(erc20Balances)
              .values({
                holder,
                token,
                balance: delta.toString(),
              })
              .onConflictDoUpdate({
                target: [erc20Balances.holder, erc20Balances.token],
                set: {
                  balance: sql`${erc20Balances.balance} + ${delta.toString()}::numeric`,
                },
              })
          }
        },
      }),
    )
}

void main()
