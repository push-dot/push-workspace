export type AppNotification = { id: string; target: { kind: 'posting' | 'conversation' | 'bot'; id: string } }
export type BillingStatus = { plan: 'FREE' | 'PRO' | 'ULTRA' | null; creditsRefillAt?: string }
