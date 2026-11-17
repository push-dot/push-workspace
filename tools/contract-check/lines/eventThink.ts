import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventThink: Sends<Event<Schema<'StreamEvent'>, 'think'>, Event<BotContract.StreamEvent, 'think'>> = true
