import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventStatus: Sends<Event<Schema<'StreamEvent'>, 'status'>, Event<BotContract.StreamEvent, 'status'>> = true
