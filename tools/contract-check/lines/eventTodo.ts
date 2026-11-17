import type { BotContract, Event, Schema, Sends } from '../contract'

export const eventTodo: Sends<Event<Schema<'StreamEvent'>, 'todo'>, Event<BotContract.StreamEvent, 'todo'>> = true
