import type { BotContract, Event, OpaqueMessages, Schema, Sends } from '../contract'

type ClientEvent = BotContract.Transcript['data'][number]['events'][number]

// A turn holds the whole event union, and an event type only the server has is not drift.
// When no server event has a type the client reads, the turn stays whole, so the line drifts instead of comparing nothing.
type Read<Transcript> = Transcript extends { data: (infer Turn extends { events: unknown[] })[] }
  ? [Event<Turn['events'][number], ClientEvent['type']>] extends [never]
    ? Transcript
    : Omit<Transcript, 'data'> & { data: (Omit<Turn, 'events'> & { events: Event<Turn['events'][number], ClientEvent['type']>[] })[] }
  : Transcript

type Client = Omit<BotContract.Transcript, 'data'> & {
  data: (Omit<BotContract.Transcript['data'][number], 'events'> & { events: OpaqueMessages<ClientEvent>[] })[]
}

export const transcript: Sends<Read<Schema<'Transcript'>>, Client> = true
