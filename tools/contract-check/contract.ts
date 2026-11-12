import type { components } from 'push-be/schema'
import type * as BotContract from 'push-fe/api-client/bot-contract'

export type { BotContract }
export type { AppNotification, BillingStatus } from 'push-fe/api-client/types'

type Schemas = components['schemas']

/** `never` while schema.ts has no type of that name, so the line waits instead of failing to compile. */
export type Schema<Name extends string> = Name extends keyof Schemas ? Schemas[Name] : never

/** check.mjs finds this text in a tsc message to tell a line that waits from one that drifts. */
type Missing = 'contract-check: push-be has no such type yet'

type Line<Server> = [Server] extends [never] ? Missing : true

/** What the server sends satisfies what the client reads. */
export type Sends<Server extends Client, Client> = Line<Server>

/** The server accepts what the client sends. The server refuses a key it does not know, and assignability alone lets one through. */
export type Accepts<Client extends Closed<Client, Server>, Server> = Line<Server>

type Closed<Client, Server> = [Server] extends [never]
  ? unknown
  : Server & { [Key in Exclude<keyof Client, keyof Server>]?: never }

/** One event type of a stream union. An event type only the server has is not drift: the app ignores a frame it does not know. */
export type Event<Union, Type extends string> = Extract<Union, { type: Type }>
