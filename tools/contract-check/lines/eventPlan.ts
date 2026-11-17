import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventPlan: Sends<Event<Schema<'StreamEvent'>, 'plan'>, Event<BotContract.StreamEvent, 'plan'>> = true
