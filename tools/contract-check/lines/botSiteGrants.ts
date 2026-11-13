import type { BotContract, Sends, SiteGrantList } from '../contract'

export const botSiteGrants: Sends<SiteGrantList, { data: BotContract.BotSiteGrant[] }> = true
