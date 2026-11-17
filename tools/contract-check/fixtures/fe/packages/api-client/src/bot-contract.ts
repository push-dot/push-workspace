export type Bot = { id: string; displayName: string; unread: boolean }
export type BotDetail = Bot & { materialCount?: number }
export type BotList = { data: Bot[] }
export type BotSearch = { bots: Bot[]; botTotal: number }
export type LinkPreview = { status: 'found'; postingId: string } | { status: 'not_a_posting' }
export type CreateBotBody = { postingId: string; displayName?: string }
export type UpdateBotBody = { expectedRevision: number; displayName?: string }
export type SendBody = { text: string; attachments?: { kind: string; id: string }[]; ai?: { model?: string; effort?: string; models?: { vision?: string } } }
export type StreamEvent =
  | { type: 'status'; text: string; phase?: 'queued' | 'thinking' | 'working' | 'waiting' }
  | { type: 'token'; text: string }
  | { type: 'done'; operation: unknown }
  | { type: 'error'; error: { code: string } }
  | { type: 'cancelled'; resumable: boolean }
  | { type: 'notice'; text: string }
  | { type: 'choice'; id: string; title?: string }
  | { type: 'plan'; id: 'strategy' | 'feedback' | 'blueprints' }
  | { type: 'fit'; score: number }
  | { type: 'result'; documentId: string }
  | { type: 'diff'; documentId: string }
  | { type: 'todo'; items: { id: string; text: string }[] }
  | { type: 'tool'; name: string; tier?: 'READ' | 'EXTERNAL_READ' | 'SAFE_WRITE' | 'RISKY_WRITE'; result?: Record<string, unknown> }
  | { type: 'paper'; id: string }
  | { type: 'think'; seconds: number; phase: string }
  | { type: 'approval'; id: string; expiresAt?: string }
export type Transcript = { data: { id: string; events: StreamEvent[] }[] }
export type TranscriptMatch = { messageId: string; at: string }
export type CardRetry = { id: string; expiresAt: string }
export type MaterialsPage = { counts: { doc: number; bookmark: number; link: number } }
export type MaterialDetail = { kind: 'file' | 'link'; id: string; title: string }
export type CardAnswer = { id: string; status: 'APPROVED' | 'REJECTED' }
export type BotSiteGrant = { host: string; kind: 'posting' | 'company' | 'other'; grantedAt: string }
