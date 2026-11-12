import type { components } from 'push-be/schema'
import type * as BotContract from 'push-fe/api-client/bot-contract'

export type { BotContract }
export type { AppNotification, BillingStatus } from 'push-fe/api-client/types'

type Schemas = components['schemas']

/** `never` while schema.ts has no type of that name, so the line waits instead of failing to compile. */
export type Schema<Name extends string> = Name extends keyof Schemas ? Schemas[Name] : never

/** check.mjs finds this text in a tsc message to tell a line that waits from one that drifts. */
type Missing = 'contract-check: push-be has no such type yet'

type Line<Server, Unknown extends string = never> = [Server] extends [never]
  ? Missing
  : [Unknown] extends [never]
    ? true
    : `contract-check: the server does not know the key ${Unknown}`

/** What the server sends satisfies what the client reads. */
export type Sends<Server extends Client, Client> = Line<Server>

/** The server accepts what the client sends. The server refuses a key it does not know, and assignability alone lets one through. */
export type Accepts<Client extends ([Server] extends [never] ? unknown : Server), Server> = Line<Server, Exclude<Keys<Client>, Keys<Server>>>

/**
 * Every key of a body at any depth, such as `ai` and `ai.model`. An array adds no segment.
 * shortcut: a key counts as known when any member of a server union has it, match the members when two members of one body differ in keys.
 * shortcut: a body that holds its own type fails as circular, cap the depth when a body is a tree.
 */
type Keys<Body> = unknown extends Body
  ? string
  : Body extends readonly (infer Item)[]
    ? Keys<Item>
    : Body extends object
      ? { [Key in keyof Body & string]: Key | `${Key}.${Keys<Body[Key]>}` }[keyof Body & string]
      : never

/** One event type of a stream union. An event type only the server has is not drift: the app ignores a frame it does not know. */
export type Event<Union, Type extends string> = Extract<Union, { type: Type }>
