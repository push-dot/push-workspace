import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventApproval: Sends<Event<Schema<'StreamEvent'>, 'approval'>, Event<BotContract.StreamEvent, 'approval'>> = true
