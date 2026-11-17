import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventTool: Sends<Event<Schema<'StreamEvent'>, 'tool'>, Event<BotContract.StreamEvent, 'tool'>> = true
