import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventPaper: Sends<Event<Schema<'StreamEvent'>, 'paper'>, Event<BotContract.StreamEvent, 'paper'>> = true
