import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventError: Sends<Event<Schema<'StreamEvent'>, 'error'>, Event<BotContract.StreamEvent, 'error'>> = true
