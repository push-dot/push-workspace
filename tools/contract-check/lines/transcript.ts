import type { BotContract, Event, Schema, Sends } from '../contract'

type ClientEvent = BotContract.Transcript['data'][number]['events'][number]

// A turn holds the whole event union, and an event type only the server has is not drift.
type Read<Transcript> = Transcript extends { data: (infer Turn extends { events: unknown[] })[] }
  ? Omit<Transcript, 'data'> & { data: (Omit<Turn, 'events'> & { events: Event<Turn['events'][number], ClientEvent['type']>[] })[] }
  : Transcript

export const transcript: Sends<Read<Schema<'Transcript'>>, BotContract.Transcript> = true
