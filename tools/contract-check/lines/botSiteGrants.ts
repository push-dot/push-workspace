import type { Sends, SiteGrantList } from '../contract'

// fo-mobile의 SiteGrant(features/bots/components/profile/site-grants.ts)는 앱 별칭을 끌고 와 여기서 컴파일되지 않아 모양을 옮겨 적는다.
// api-client가 BotSiteGrant를 내보내면 그 타입으로 바꾼다.
type ClientSiteGrant = { host: string; kind: 'posting' | 'company' | 'other'; grantedAt: string }

export const botSiteGrants: Sends<SiteGrantList, { data: ClientSiteGrant[] }> = true
