import type { Accepts, BotContract, Schema } from '../contract'

export const send: Accepts<BotContract.SendBody, Schema<'BotSendBody'>> = true
