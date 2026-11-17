import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventFit: Sends<Event<Schema<'StreamEvent'>, 'fit'>, Event<BotContract.StreamEvent, 'fit'>> = true
