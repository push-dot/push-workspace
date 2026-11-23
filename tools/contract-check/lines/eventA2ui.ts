import type { BotContract, Event, OpaqueMessages, Schema, Sends } from '../contract'

export const eventA2ui: Sends<Event<Schema<'StreamEvent'>, 'a2ui'>, OpaqueMessages<Event<BotContract.StreamEvent, 'a2ui'>>> = true
