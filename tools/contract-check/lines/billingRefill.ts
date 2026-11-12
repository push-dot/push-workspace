import type { BillingStatus, Schema, Sends } from '../contract'

// Only this field is compared. The rest of this type is outside the bot contract and already differs between the two repos.
type Field<Type, Name extends string> = Name extends keyof Type ? Pick<Type, Name> : never

export const billingRefill: Sends<Field<Schema<'BillingStatus'>, 'creditsRefillAt'>, Pick<BillingStatus, 'creditsRefillAt'>> = true
