import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventCancelled: Sends<Event<Schema<'StreamEvent'>, 'cancelled'>, Event<BotContract.StreamEvent, 'cancelled'>> = true
