import type { AppNotification, Schema, Sends } from '../contract'

// Only the kind `bot` is compared. The rest of this type is outside the bot contract and already differs between the two repos.
type Kind<Notification extends { target?: { kind?: string } }> = NonNullable<NonNullable<Notification['target']>['kind']>

export const notificationBotTarget: Sends<Extract<Kind<Schema<'Notification'>>, 'bot'>, Extract<Kind<AppNotification>, 'bot'>> = true
