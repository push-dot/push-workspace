import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventDiff: Sends<Event<Schema<'StreamEvent'>, 'diff'>, Event<BotContract.StreamEvent, 'diff'>> = true
