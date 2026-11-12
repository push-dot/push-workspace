import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventNotice: Sends<Event<Schema<'StreamEvent'>, 'notice'>, Event<BotContract.StreamEvent, 'notice'>> = true
