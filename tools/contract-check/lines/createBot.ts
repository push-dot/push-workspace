import type { Accepts, BotContract, Schema } from '../contract'

export const createBot: Accepts<BotContract.CreateBotBody, Schema<'CreateBotBody'>> = true
