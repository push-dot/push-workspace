import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventToken: Sends<Event<Schema<'StreamEvent'>, 'token'>, Event<BotContract.StreamEvent, 'token'>> = true
