import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventResult: Sends<Event<Schema<'StreamEvent'>, 'result'>, Event<BotContract.StreamEvent, 'result'>> = true
