import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventChoice: Sends<Event<Schema<'StreamEvent'>, 'choice'>, Event<BotContract.StreamEvent, 'choice'>> = true
