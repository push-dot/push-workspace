import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventDone: Sends<Event<Schema<'StreamEvent'>, 'done'>, Event<BotContract.StreamEvent, 'done'>> = true
