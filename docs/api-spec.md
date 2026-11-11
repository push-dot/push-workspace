# Push API 명세

- 버전: 2.2
- 작성일: 2026-11-11
- 기준: push-be `develop` `d73240d`, push-fe `develop` `193dbd5`. 코드가 OpenAPI(`packages/contracts/openapi.json`)와 다르면 코드를 따른다.
- 이전 버전: `docs/api.md` (커밋 `72fe539`에서 삭제)
- 관련 문서: [PRD.md](PRD.md), [feature-spec.md](feature-spec.md)

## 1. 범위와 구성

- 클라이언트는 데스크톱(Tauri), 모바일(Expo), fo-web(기업·구직자 웹, 일부 화면은 앱 WebView)이고 모두 같은 API를 쓴다.
- 접두사는 `/api/v1`이다. 요청은 gateway Worker가 먼저 받는다. `routes/owner.ts`의 `ownerOf`가 담당을 정한다.

| 담당 | 위치 | 처리하는 요청 |
|---|---|---|
| gateway | `services/gateway` | `/healthz`, `GET /auth/me`, 대화 목록·메시지 조회, `GET .../messages/stream/active`, 메시지 스트림의 SSE, `GET /ai/models`, `GET /integrations/job-sites` |
| core | `services/core-api` | `isCore`에 있는 경로. auth, 대화 쓰기, 서류, 출처, 이미지, 결제, 채용, 허브, 소셜, 회사, 캘린더, Google 연동, `/api/v1/bots` 및 `/api/v1/bots/`로 시작하는 경로(`services/gateway/src/routes/owner.ts`) |
| ai | `services/ai` | `isPython`에 있는 실행 경로만. 생성, 이력서 실행, 공고 분석, 면접 준비, 문서 개정·내보내기, 근거 가져오기, 프로필 초안, 블루프린트, 검증, operation, approval, 대화 공유·산출물 목록 |

- `/internal`과 `/internal/*`는 gateway가 넘기지 않는다.
- `//`, `%2F`, `%5C`가 들어 있는 경로는 넘기지 않는다.
- 위 표에 없는 경로는 넘기지 않는다. ai로 떨어지지 않는다.
- ai가 HTTP로 올리는 라우터는 `main.py`에 있는 것만이다. evidence, jobs, applications, documents, projects, interviews, conversations, approvals, operations, ai, internal. auth·billing·calendar용 HTTP 라우터는 없다. 그 경로는 core가 처리한다.

`isPython` 경로

- `POST /ai/generate`
- `POST /applications/{id}/resume-run`
- `POST /jobs/{id}/analyze`
- `POST /interviews/{id}/prepare`
- `POST /documents/{id}/revisions`
- `GET /documents/{id}/versions/{versionId}/export`
- `POST /career-evidence/import`
- `GET /sources/{id}/profile-draft`
- `POST /projects/blueprints`
- `POST /projects/{id}/evidence/{evidenceId}/verify`
- `GET /operations/{id}`, `GET /operations/{id}/events`
- `POST /operations/{id}/input`, `POST /operations/{id}/cancel`
- `GET`·`POST /approvals`, `GET /approvals/{id}`, `POST /approvals/{id}/decision`
- `POST /conversations/{id}/share`
- `GET /conversations/shared/{token}`
- `GET /conversations/{id}/artifacts`

## 2. 공통 계약

### 2.1 주소·형식

- 개발: `http://localhost:8080/api/v1` (ai uvicorn). gateway와 core는 `wrangler dev`로 띄운다.
- 운영: `https://push-be.<account>.workers.dev/api/v1`
- 요청과 응답은 UTF-8 JSON이고 필드 이름은 camelCase다. ID는 UUID, 시각은 RFC3339 UTC(마이크로초까지), 날짜는 `YYYY-MM-DD`다.
- ai 요청 스키마는 모르는 필드를 받지 않고 타입을 엄격하게 검사한다(`extra=forbid, strict`).
- 서버가 관리하는 필드(`userId`, `createdAt`, `revision` 등)를 요청 본문에 넣으면 거부한다.
- 모든 응답에 `x-request-id`가 붙는다. 클라이언트가 `^[A-Za-z0-9._:-]{1,128}$`에 맞는 값을 보내면 그대로 돌려주고, 아니면 `req_<uuid>`를 새로 만든다.

### 2.2 인증

- 형식은 `Authorization: Bearer <accessToken>`이다. access token은 900초, refresh token은 30일이다.
- OAuth state는 10분, exchange code는 60초, 이메일 인증 링크는 24시간, 비밀번호 재설정 링크는 1시간이다.
- 휴대폰 인증번호 기본 수명은 180초, 다시 보내기 대기 168초, 틀린 입력은 5회까지다.
- 가입 대기 토큰(`pendingToken`)은 900초다.
- `APP_ENV=development`일 때 `DEV_AUTH_TOKEN`과 같은 bearer를 개발용으로 받는다.
- 다른 사용자의 리소스는 존재 여부를 드러내지 않고 404로 응답한다.

공개 경로. 토큰 없이 호출한다.

- `GET /auth/{google|github|apple}/start`
- `GET /auth/{google|github}/callback`. Apple의 GET callback은 400 `VALIDATION_ERROR` "apple callback is POST form_post"
- `POST /auth/apple/callback`, `POST /auth/apple/native`
- `POST /auth/exchange`, `POST /auth/refresh`, `POST /auth/logout`
- `POST /auth/email/signup|verify|login|password-reset|password-reset/confirm`
- `POST /auth/phone/send`, `POST /auth/phone/verify`. OpenAPI는 send를 인증 필요로 표시하지만 핸들러는 공개다. bearer가 있으면 개인 계정만 받는다. 기업 bearer는 403 "phone auth is for personal accounts"
- `POST /billing/webhook`, `POST /billing/webhook/app-store`, `POST /billing/webhook/google-play`
- `GET /companies/invites/{token}`
- `GET /uploads/images/{key}`
- `GET /integrations/google/callback`
- `/healthz`
- 게스트 조회(토큰이 없으면 게스트): `GET /postings`, `GET /postings/locations`, `GET /postings/facets`, `GET /postings/{uuid}`, `GET /postings/{uuid}/applicant-counts`, `GET /search`, `GET /search/counts`, `GET /search/trending`. `applicant-counts`는 멤버 검사를 다시 해서 게스트는 404다. 사람·게시글 검색은 게스트에게 401이다. counts와 trending은 게스트가 본다.

`GET /auth/me`는 gateway가 답한다. core로 넘기지 않는다.

### 2.3 응답

- 단건: `{"data": {...}}`
- 목록: `{"data": [...], "page": {"nextCursor": "...|null", "hasMore": bool}}`. 일부 목록은 `page.total`을 더한다.
  - `limit`은 1–100(기본 50)이고 `cursor`는 불투명한 값이다.
  - 정렬 기본은 `createdAt DESC, id DESC`다. 대화 목록만 `updatedAt DESC, id DESC`다.
- 비동기 작업은 202와 `Operation`을 돌려준다.
- 오류: `{"error": {"code", "message", "requestId", "details"}}`
  - `details`에는 복구에 필요한 값만 담는다. 예: `{field}`, `{currentRevision}`, `{accountType}`, `{existingProviders}`, `{retryAfterSec}`, `{requiredPlan}`, `{reason}`

| HTTP | code |
|---|---|
| 200 / 201 / 202 / 204 | 성공: 조회·수정 / 생성 / 비동기 접수 / 본문 없음 |
| 400 | `VALIDATION_ERROR`, `EMAIL_NOT_VERIFIED`(exchange), `PHONE_CODE_INVALID`, `PHONE_CODE_EXPIRED` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` |
| 403 | `FEATURE_DISABLED`, `FORBIDDEN`, `EMAIL_NOT_VERIFIED`(로그인), `CONSENT_REQUIRED`, `BUSINESS_NOT_VERIFIED`, `PLAN_REQUIRED`, `SEAT_LIMIT`, `BOT_LIMIT`(회사 봇 생성 한도. `details`: `{limit, plan}`), `DEFAULT_BOT_PROTECTED`(Push 봇 삭제·보호) |
| 404 | `NOT_FOUND` (ai는 405도 `NOT_FOUND`로 돌려준다) |
| 409 | `REVISION_CONFLICT`, `INVALID_TRANSITION`, `APPROVAL_REQUIRED`, `APPROVAL_STALE`, `UNSUPPORTED_CLAIM`, `INTEGRATION_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `CONFLICT`, `EMAIL_TAKEN`, `PHONE_TAKEN`, `PHONE_ALREADY_REGISTERED`, `ADMIN_TRANSFER_REQUIRED`, `ALREADY_SUBSCRIBED`, `COMPANY_EXISTS` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 422 | `VERIFICATION_FAILED`, `DOCUMENT_NOT_FINALIZED`, `BUSINESS_NOT_VERIFIED`, `VALIDATION_ERROR`(설정 enum) |
| 429 | `RATE_LIMITED`(`details.retryAfterSec`. 봇 생성 락 대기 종료·분당 한도 등. 휴대폰 재발송 168초·이메일 60초와 값이 다를 수 있음), `QUEUE_BUSY` |
| 500 | `INTERNAL` |
| 502 | `PROVIDER_ERROR` |
| 503 | `NOT_CONFIGURED`, `TEMPORARILY_UNAVAILABLE` |

`GET /auth/me`에서 토큰이 없으면 401 `UNAUTHENTICATED` "missing bearer token", 만료면 401 `TOKEN_EXPIRED` "access token expired"다. 캐시는 `private, no-cache`다.

### 2.4 동시성·멱등성

- **revision**: 버전이 있는 리소스의 PATCH와 상태를 바꾸는 POST·DELETE에는 `expectedRevision`이 필요하다.
  - 값이 다르면 409 `REVISION_CONFLICT`와 `{currentRevision}`을 돌려준다.
  - 성공하면 revision이 1 올라간다.
- **Idempotency-Key**: 로그인한 사용자의 POST에는 UUID가 필요하다. 경로가 `/stream`으로 끝나면 빠진다. 공개 POST, `POST /internal/notifications/*`도 빠진다. PATCH, PUT, DELETE에는 쓰지 않는다. ai도 로그인한 POST이고 경로가 `/stream`으로 끝나지 않으면 같은 규칙을 쓴다.
  - 같은 사용자, 경로, 키에 같은 본문(SHA-256)을 보내면 저장된 응답을 그대로 돌려준다.
  - 본문이 다르거나 처리 중이면 409 `IDEMPOTENCY_CONFLICT`다.
  - 2xx가 아닌 응답이 나면 예약이 풀려서 같은 키를 다시 쓸 수 있다. 5분 넘게 처리 중인 예약은 지운다.

### 2.5 한도

- **속도**
  - 인증 사용자: 분당 600회. gateway, core, ai가 Neon `rate_limits`를 함께 쓴다. gateway 읽기는 `limit - floor(limit/10)`에서 멈춘다. 600이면 540이다. `limit`이 10 미만이면 그대로다.
  - Worker는 같은 UTC 분 버킷이 이미 가득 찬 것으로 기억한 뒤의 거절에서 Neon 왕복을 생략한다(#274).
  - VPS의 AI 요청 경로는 Postgres `rate_limits`를 쓰지 않는다. Redis가 있으면 Redis이고, 없거나 Redis 오류면 그 프로세스 메모리의 슬라이딩 윈도다.
  - 공개 경로: IP당 분당 60회
- **본문**: ai는 20MiB가 넘으면 413이다. 필드별 제한은 각 엔드포인트에 적는다.
- **CORS 허용 Origin**: `tauri://localhost`, `http://tauri.localhost`, `https://tauri.localhost`, localhost와 127.0.0.1(모든 포트). fo-web 운영 Origin은 없다(6장).
- **허용 헤더**: `Origin`, `Content-Type`, `Accept`, `Authorization`, `Idempotency-Key`, `X-Request-Id`. preflight `Access-Control-Max-Age`는 600초다.
- **허용 메서드**: GET, POST, PATCH, PUT, DELETE, OPTIONS

### 2.6 공통 타입

- `Operation`: `{id, type, applicationId, status, progress, result:{kind, value}, error, inputRequest, createdAt, updatedAt}`
  - status: `QUEUED | RUNNING | NEEDS_INPUT | SUCCEEDED | FAILED | CANCELLED`
- `AiOptions`: `{provider*, model*, effort, ultraResume, webSearch, models}`
  - provider: `OPENAI | OPENROUTER | CLAUDE | GEMINI | GROK`. 이것은 모델 계열 이름이다. 호출은 OpenRouter로 간다(3.14).
  - effort: `LOW | MEDIUM | HIGH | MAX`. 요청에 넣어도 요금제가 다시 정한다(3.14).
- `Session`: `{accessToken, refreshToken, expiresIn: 900, user}`. user는 `{id, displayName, locale, accountType, companyId, companyRole}`이다.

### 2.7 크레딧

화면에는 크레딧 숫자를 보여주지 않는다. 원장과 `costMicroCredits` 같은 내부 이름은 그대로 둔다. 표시 단위 1크레딧은 6000 마이크로크레딧이다.

| 대상 | 요금제 | 월 마이크로크레딧 | 표시 크레딧 |
|---|---|---|---|
| 개인 | FREE | 1,800,000 | 300 |
| 개인 | PRO | 27,000,000 | 4,500 |
| 개인 | ULTRA | 108,000,000 | 18,000 |
| 기업 | BASIC | 18,000,000 | 3,000 |
| 기업 | PRO | 90,000,000 | 15,000 |
| 기업 | ULTRA | 180,000,000 | 30,000 |

- 월 지급은 결제 조회 때 `monthly:YYYY-MM` 참조로 넣고, 원장 type은 `PURCHASE`다. 기준은 UTC 월이다.
- core가 넣는 원장 type은 `PURCHASE`뿐이다. ai의 `LEDGER_REFUND`는 정의만 있고 쓰지 않는다. 스토어 `REFUND|EXPIRED|REVOKE`는 요금제를 바꾸고 원장 type을 만들지 않는다.
- 인앱 크레딧 상품 기본량은 300크레딧(`IAP_TOPUP_CREDITS`, 비어 있으면 300)이다.

## 3. 엔드포인트

표 보는 법: `*`는 필수다. 🔑은 `Idempotency-Key`가 필요하다는 뜻이다. "page"는 목록 응답이다. 경로는 `/api/v1` 뒤를 적는다.

### 3.1 health (gateway)

| 메서드·경로 | 비고 |
|---|---|
| `GET /healthz` | 공개, 속도 제한 없음 → `{status:"ok"}` |
| `GET /api/v1/healthz` | 공개, IP당 분당 60회 |

### 3.2 auth (core, `GET /auth/me`만 gateway)

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /auth/{google\|github\|apple}/start` | `codeChallengeMethod*`=S256, `codeChallenge*`, `redirectUri*` (`push://auth/callback` 또는 `http://localhost:5173/auth/callback`), `accountType`(`PERSONAL\|EMPLOYER`, 기본 `PERSONAL`) | `{authorizationUrl, state, expiresAt}`. GitHub·Apple에 `EMPLOYER`면 400 `VALIDATION_ERROR` |
| `GET /auth/{google\|github}/callback` | `code`, `state` | 302 → `{finalUri}?code=` |
| `POST /auth/apple/callback` | form `code*`, `state*`, `user`(JSON, 선택) | 302 또는 Session 교환용 code. Apple 웹 로그인 |
| `POST /auth/apple/native` | `identityToken*`, `nonce*`. audience는 `APPLE_BUNDLE_ID`. 계정은 `PERSONAL`로 고정 | 새 개인 계정이면 `{pendingToken, expiresIn:900}`. 아니면 Session |
| `POST /auth/exchange` | `code*`, `codeVerifier*` | Session. 제공사 이메일이 인증되지 않았으면 400 `EMAIL_NOT_VERIFIED`(GitHub은 `verified`인 기본 이메일만). 이메일이 다른 계정 종류로 이미 있으면 409 `EMAIL_TAKEN`(`details.accountType`) |
| `POST /auth/email/signup` | `email*`, `password*`(8–128), `accountType*`(`EMPLOYER`만. `PERSONAL`은 400), `displayName*`(1–80) | 202 `{accepted:true}`. 인증 메일을 보낸다. `consentReference`는 읽지 않고 `consent_reference=false`로 넣는다. 이메일이 이미 있으면 409 `EMAIL_TAKEN` |
| `POST /auth/email/verify` | `token*` | Session. 이때 계정이 생긴다 |
| `POST /auth/email/login` | `email*`, `password*` | Session. 인증 전이면 403 `EMAIL_NOT_VERIFIED`, 틀리면 401 `INVALID_CREDENTIALS` |
| `POST /auth/email/password-reset` | `email*` | 202. 이메일 존재 여부를 드러내지 않는다 |
| `POST /auth/email/password-reset/confirm` | `token*`, `password*` | 204. 그 사용자의 refresh token을 모두 폐기한다 |
| `POST /auth/phone/send` | `phone*` E.164 `+[1-9]\d{7,14}` | 202 `{cooldownSeconds, expiresAt}`. 대기가 남으면 429 `RATE_LIMITED` `retryAfterSec`. SMS 설정이 없으면 503 `NOT_CONFIGURED`. `PHONE_SMS_MODE=log`는 development에서만 쓴다. 발송 업체는 미결이다 |
| `POST /auth/phone/verify` | `phone*`, `code*` 6자리, `pendingToken`(소셜 연결일 때) | 200 Session과 `created`. 연결이면 `linked:true`와 `provider`. 코드가 틀리면 400 `PHONE_CODE_INVALID`. 만료는 해시보다 먼저 보고 400 `PHONE_CODE_EXPIRED`. 5회를 넘으면 429 `RATE_LIMITED`. 다른 계정에 연결된 번호는 409 `PHONE_TAKEN` "this login is already linked to another account". 이미 가입된 번호는 409 `PHONE_ALREADY_REGISTERED`(`details.existingProviders`). 소셜로 들어온 새 사용자가 같은 번호를 확인하면 그 계정에 provider가 연결된다 |
| `POST /auth/refresh` | `refreshToken*` | Session. refresh token을 새로 바꾼다. 폐기된 토큰을 다시 쓰면 그 사용자의 토큰을 전부 폐기한다 |
| `POST /auth/logout` | `refreshToken*` | 204 |
| `POST /auth/email/verify/resend` | `{email}` | 항상 204. 메일 버킷은 주소당 분당 3통이고 가입·비밀번호 재설정과 공유한다. 넘치면 429 `RATE_LIMITED`, `retryAfterSec` 60. 주소가 없어도 204(#267) |
| `DELETE /me` 🔑 | – | 204. 기업 관리자에게 다른 멤버가 있으면 409 `ADMIN_TRANSFER_REQUIRED` "transfer admin before deleting the account". 관리자뿐이면 `companies.deletion_requested_at`을 찍고, 회사 Stripe 고객이 사용자와 다르면 그 구독을 해지한다. 해지 실패는 502 `PROVIDER_ERROR` "stripe subscription cancel failed"이고 시각을 되돌린다. 성공하면 `users.deletion_requested_at`을 찍고 토큰을 폐기한다. 다시 로그인하면 그 시각을 지운다. 30일이 지나면 삭제 작업이 사용자 행을 지운다. 유예 중에는 허브 프로필과 소셜 글이 목록·상세에서 빠진다. 개인 구독은 인앱 결제라 서버가 해지하지 않는다 |
| `GET /auth/me` | – | `{id, displayName, locale, createdAt, accountType, companyId, companyRole, email, provider, plan}`. plan은 `FREE\|PRO\|ULTRA`. phone과 구독 상태는 없다 |

### 3.3 conversations

읽기·목록·진행 중 스트림은 gateway, 쓰기와 메시지 접수는 core, 공유와 산출물 목록은 ai, 산출물 한 건은 core다.

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /conversations` | page, `applicationId`, `q`, `audience`(`PERSONAL\|EMPLOYER`, 기본 PERSONAL), `archived`(`true`만 보관 목록) | page. 기본 목록은 `archived=false`. 기업 audience에 회사가 없으면 403 `BUSINESS_NOT_VERIFIED`. 항목 `{id, revision, applicationId, title, pinned, createdAt, updatedAt, status, lastMessagePreview, createdBy:{displayName}, postingId}`. status는 `NEEDS_APPROVAL\|RUNNING\|DONE` |
| `POST /conversations` 🔑 | `title*`(≤300), `applicationId`, `audience`(`PERSONAL\|EMPLOYER`), `postingId` | 201 Conversation. 개인은 참고 데이터 동의가 없으면 403 `CONSENT_REQUIRED` "reference data consent is required". 기업은 사업자 확인 전이면 403 `BUSINESS_NOT_VERIFIED` |
| `PATCH /conversations/{id}` | `expectedRevision*`, `title`, `pinned` | Conversation |
| `DELETE /conversations/{id}` | – | 204 |
| `POST /conversations/{id}/archive` 🔑 | `expectedRevision*` | Conversation. 이 대화에서만 쓰던 근거도 함께 보관한다. 보관을 해제해도 그 자료와 첨부는 돌아오지 않는다 |
| `POST /conversations/{id}/unarchive` 🔑 | `expectedRevision*` | Conversation. 보관만 푼다 |
| `POST /conversations/{id}/share` 🔑 | – | 공유 토큰. ai |
| `GET /conversations/shared/{token}` | – | 공개. ai |
| `GET /conversations/{id}/messages` | page | page `Message{id, conversationId, role, text, attachments[], operationId, createdAt}`. 첨부 제목·이름·`fileName`이 `.md`로 끝나거나 mime이 `text/markdown`이면 뺀다 |
| `POST /conversations/{id}/messages` 🔑 | 아래 | 202 `{type:"CHAT_MESSAGE", result:{kind:"CHAT_MESSAGE", value:{jobId}}}` |
| `POST /conversations/{id}/messages/stream` | 같은 본문. Idempotency-Key 없음 | 202가 아니면 그대로 반환. 202면 gateway가 SSE를 seq 0부터 연다 |
| `GET /conversations/{id}/messages/stream/active` | `after` 또는 `Last-Event-ID`. 숫자가 아니면 0. `after`가 우선 | SSE. 진행 중인 작업이 없으면 204 |
| `POST /conversations/{id}/stream/cancel` 🔑 | – | 진행 중 작업을 취소하고 `cancelled` 이벤트를 남긴다 |
| `POST /conversations/{id}/approvals/{approvalId}` 🔑 | `optionId`, `optionIds[]` | 200. 이력서 확인 카드의 답 |
| `POST /conversations/{id}/attachments` 🔑 | multipart `file`. PDF, 10MiB | 201. 기업 대화의 PDF. 개인 채팅 첨부가 아니다 |
| `GET /conversations/{id}/artifacts` | – | ai. 메시지 첨부 중 `DOCUMENT_VERSION`이거나 `documentId`가 있는 항목. 마크다운은 뺀다 |
| `GET /conversations/{id}/artifacts/{name}` | – | core. 워크스페이스 파일 바이트. 이름이 `.`으로 시작하면 거절. 이름을 알면 `.md`도 받는다. 목록과 스트림은 이 파일을 보여주지 않는다 |

메시지 본문. 다른 키는 400이다.

- `text*` 1–20000
- `accessMode`: `ALWAYS_ASK|AUTO|BYPASS|SUGGEST|CONFIRM_ACTIONS`. `SUGGEST`는 `AUTO`, `CONFIRM_ACTIONS`는 `ALWAYS_ASK`. 생략하면 저장한 `aiAccessMode`, 없으면 `AUTO`
- `context`: `documentId`, `versionId`, `evidenceIds[]`(UUID). 생략하면 `{}`
- `ai`: 있으면 `provider`와 `model`이 필수. 계열은 2.6. `effort`는 저장했다가 요금제 값으로 덮는다. `ultraResume`은 ULTRA가 아니면 403 `FEATURE_DISABLED`
- `intent`: `posting|review|interview|general|match_posting|fit|gaps|experience|boost|find_postings|deadline_postings|applications|calendar|hub_profile|offer_reply|coffee_chat|career_post`. 개인 전용 intent를 기업 대화에 쓰면 400. `interview`는 기업 요금제 잠금(`assertPlanAllows`)
- `applicationId`

개인 대화(`company_id`가 null)의 생성과 메시지는 `requireAgentConsent`를 탄다. 동의 행이 없거나 `reference_data`가 false면 403 `CONSENT_REQUIRED`다.

채팅 첨부. 개인 앱은 `POST /conversations/{id}/attachments`를 쓰지 않는다.

1. `POST /sources` multipart. 앱은 `kind=RESUME`과 `file`을 보낸다. 서버는 `kind`가 비어 있지 않은 문자열인지만 보고, 저장하지 않는다.
2. `POST /conversations/{id}/messages`의 `context.evidenceIds`에 그 source id를 넣는다.
3. 마이 › 서류의 "AI로 고치기"는 글 `"이 서류를 고쳐 줘"`와 `evidenceIds:[서류 id]`로 대화를 만든다.

올린 이력서로 이력서 흐름에 들어가는 조건. `intent`가 없고, 글에 `고쳐|고치|맞춰|맞추|개선|tailor|improve`가 있고, `evidenceIds`의 파일이 pdf·word MIME이거나 이름이 `.pdf|.docx|.doc`으로 끝나면 `inputs.source`는 `external`이다. 결과 이벤트의 `source`도 `external`이다. `intent`가 있으면 이 갈림으로 가지 않는다.

큐. `QUEUE_BACKEND=redis`면 큐에 넣는다. 아니면 `chat_jobs`에 넣고 `AI_ORIGIN`의 `/internal/chat/schedule`을 깨운다. 가득 차면 429 `QUEUE_BUSY`와 `retryAfterSec`다.

**SSE(채팅)**

- 첫 프레임은 `retry: 400`이다. `event:` 줄은 없다. `id: <seq>`와 `data: {..., seq}`다.
- `{type:"token", text, seq}`
- `{type:"status", text, seq}`
- `{type:"error", error:{code, message, details}, seq}`
- `{type:"done", operation, awaiting?, seq}`
- `{type:"cancelled", seq}`
- 그 밖은 `{type, ...payload, seq}`다. 결과와 확인 카드가 여기 들어간다.
- 빈 조회는 `: ping`을 보낸다. 주기는 250ms에서 시작해 두 배씩 늘리고 1000ms에서 멈춘다. 한 페이지가 200건이면 ping도 sleep도 없다.
- `SSE_MAX_POLLS` 기본 20이다. 횟수를 다 쓰면 오류 프레임 없이 연결을 닫는다. 앱은 `GET /conversations/{id}/messages/stream/active?after=<마지막 seq>`로 다시 붙는다. `after`가 없으면 쿼리에서 뺀다. `Last-Event-ID` 헤더는 보내지 않는다. `done|error|cancelled`까지 반복한다.
- 조회가 실패하면 `id` 없는 `{"type":"error","error":{"code":"INTERNAL","message":"internal error","details":null}}` 하나를 보낸다.
- `type:file`이고 이름이 `.md`로 끝나거나 mime이 `text/markdown`이면 프레임을 보내지 않는다. `save_artifact`도 마크다운 file 이벤트를 내지 않는다. PDF 바이트는 워크스페이스에 남는다.

**결과 이벤트** (`type:result`). gateway가 `seq`를 붙인다.

외부 파일(`source:external`)

- `taskLine`: "이력서 수정 · 올린 파일 · 경력"
- `checklist`: 이력서 읽기, 공고 요건 정리, 적합도 계산, 경력 섹션 고치기, PDF로 만들기
- `fileName`, `pageLine` (`A4 {n}쪽 · {size}`), `documentId`
- 저장되면 `savedLine` "내 서류에 자동 저장됨", `cardMeta`는 `"{pageLine} · 내 서류에 자동 저장됨"`. 실패하면 `cardMeta`는 `pageLine`만
- `company`는 공고 회사가 있을 때만
- actions: 회사가 있으면 `{id:"apply", label:"{company}에 바로 지원하기"}`. 저장되고 `documentId`가 있으면 `{id:"convert", label:"프로필로 전환", method:"POST", path:"/api/v1/documents/{id}/profile"}`

프로필(`source:profile`)

- `taskLine`: "프로필 수정 · Push 프로필 · 경력"
- `checklist`: 프로필 읽기, 공고 요건 정리, 적합도 계산, 경력 섹션 고치기, 프로필에 저장
- `name`, `headline`, `title`(`"{name} · {headline}"` 또는 "Push 프로필"), `subtitle` "Push 프로필 · 방금 수정", `documentId`
- actions는 외부와 같은 apply 규칙. `documentId`가 있으면 `{id:"view", label:"프로필 보기"}`

파일 이름. `edited_pdf_name`이다. 이름 조각은 프로필 표시 이름이다. 공고 회사가 있으면 `{이름}_{회사}_{직무}.pdf`다. 빈 조각은 뺀다. `/ \ : * ? " < > |`와 공백을 지우고, 80자를 넘기면 자른다. 직무는 공고의 `role`, `jobCategory`, `category`에서 고른다. `dev|data|design|plan|marketing|sales|hr|ops`는 건너뛴다. 그 칸이나 제목에 프론트엔드, 백엔드, 풀스택, 데이터, 디자인, 기획, 마케팅, 머신러닝, devops, ios, android, qa가 있으면 그 단어를 쓴다. 회사가 없으면 `{원본 줄기}_수정본.pdf`다. `_수정본`도 80자에 넣는다. 줄기가 없으면 `이력서`다.

**확인 카드** (`type:choice`, `kind:RESUME_GATE`). 필드 `id`, `gate`, `title`, `recommended`, `options`, 그리고 `documentId`, `multiple`, `auto`, `detail`.

| gate | title |
|---|---|
| `mode_select` | 어떤 방식으로 진행할까요? |
| `output_targets` | 어떤 산출물을 만들까요? |
| `tone` | 어떤 말투로 쓸까요? |
| `intake` | 입력한 자료를 확인했어요. 분석을 시작할까요? |
| `analyze` | 이 공고에 맞춰 이력서를 고칠까요? |
| `feedback` | 피드백을 반영해서 수정할까요? |
| `strategy` | 이 전략대로 초안을 쓸까요? |
| `craft` | 첫 번째 초안(v1)이에요. 이대로 검토할까요? |
| `review` | 검증을 마쳤어요. 어떤 디자인을 적용할까요? |
| `approach` | 어떤 접근 방식으로 진행할까요? |
| `level` | 병목 강도를 어느 정도로 할까요? |
| `prevention` | 어떤 문제를 예방할까요? |
| `projects` | 어떤 프로젝트를 구현할까요? |
| `validate_cap` | 검증을 통과하지 못했어요. 다른 방향으로 다시 고를까요? |
| `boost` | 점수를 한 번 더 올릴까요? |

결과 제시. 프로필 기본 제목은 "Push 프로필에 저장했어요. 결과를 확인할까요?"이고 안내 "PDF는 Push 프로필에서 내보낼 수 있어요."를 붙인다. 외부 파일이 저장되면 "내 서류에 저장했어요. 결과를 확인할까요?". 저장에 실패하면 "내 서류에 저장하지 못했어요. 결과를 확인할까요?".

`review` 선택지는 `CLASSIC|MODERN|COMPACT|ATS`다. `AUTO`는 카드에서 멈춘다. `BYPASS`는 `mode_select`, `validate_cap`, 첨부가 없는 `intake`를 빼고 자동으로 답한다.

에이전트 서류 목록. 문서 목록(기본 limit 50)과 출처 `origin IN ('UPLOAD','AI')` 최신 50건(`created_at DESC, id DESC`)을 함께 본다. 올린 파일이 들어간다. 이름 `.md` 또는 mime `text/markdown`은 뺀다.

### 3.4 approvals (ai)

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /approvals` | page, `applicationId`, `status` | page Approval |
| `POST /approvals` 🔑 | `kind*`, `targetId*`, `applicationId`, `targetRevision` | 201 Approval |
| `GET /approvals/{id}` | – | `{approval, target}` |
| `POST /approvals/{id}/decision` 🔑 | `expectedRevision*`, `decision*`(`APPROVED\|DENIED`) | Approval |

- kind: `EVIDENCE_USE | DOCUMENT_FINALIZE | APPLICATION_SUBMIT | CLI_EXECUTE`
- status: `PENDING | APPROVED | DENIED | EXPIRED | CONSUMED`. 기본 유효 기간은 24시간이다.
- 채팅 확인 카드의 답은 이 경로가 아니라 3.3의 conversation approval이다.

### 3.5 operations (ai)

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /operations/{id}` | – | Operation |
| `POST /operations/{id}/input` 🔑 | `fields{}`(작업이 요청한 키만), `sourceId` | Operation |
| `POST /operations/{id}/cancel` 🔑 | – | Operation |
| `GET /operations/{id}/events` | – | SSE. `event: progress\|result\|error`, `data:{operationId, sequence, payload}`. 채팅 SSE와 형식이 다르다 |

type: `EVIDENCE_IMPORT, JOB_ANALYSIS, DOCUMENT_GENERATE, DOCUMENT_REVISE, PROJECT_BLUEPRINTS, PROJECT_VERIFY, INTERVIEW_PREPARE, RESUME_WORKFLOW, AI_GENERATE, CHAT_MESSAGE, GOOGLE_SYNC, APPLICATION_SUBMIT`

`GET /ai/jobs/{id}`는 core다. `{id, type, status, progress, result, error, createdAt, updatedAt}`

### 3.6 jobs: 내 공고 (core, 분석은 ai)

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /jobs` | page, `archived`, `query`(회사·제목 ILIKE) | page Job |
| `POST /jobs` 🔑 | `company*`(1–200), `title*`(1–300), `sourceKind*`(`URL\|TEXT\|DOM`), `sourceText*`(1–200000), `language*`, `sourceUrl`(URL·DOM일 때 필수, 자격증명 없는 http(s)), `requirements[]`, `preferred[]`, `deadline` | 201 Job |
| `GET /jobs/{id}` | – | Job |
| `PATCH /jobs/{id}` | `expectedRevision*`, `company`, `title`, `requirements`, `preferred`, `deadline`(null이면 지움) | Job |
| `GET /jobs/{id}/analyses` | page | page `GapAnalysis{matched, missing, preferredMissing, risks, fitScore, stale, ...}` |
| `POST /jobs/{id}/analyze` 🔑 | `applicationId*`, `expectedRevision*`, `evidenceIds[]`, `ai` | 202 `JOB_ANALYSIS`. ai |

Job: `{id, revision, company, title, sourceKind, sourceUrl, sourceText, requirements, preferred, keywords, risks, deadline, language, createdAt, updatedAt}`

### 3.7 applications (core, `resume-run`만 ai)

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /applications` | page, `stage`, `query` | page Application |
| `POST /applications` 🔑 | `jobId*`, `notes` | 201 |
| `POST /applications/import` 🔑 | `jobId*`, `stage*`(DISCOVERED 제외), `appliedAt*`, `confirmed`(true), `notes` | 201 |
| `GET /applications/{id}` | – | Application |
| `PATCH /applications/{id}` | `expectedRevision*`, `stage`, `notes`, `nextActionAt` | Application. APPLIED로 직접 바꾸면 `INVALID_TRANSITION`. 이 PATCH는 `APPLICATION_STAGE` 알림을 보내지 않는다 |
| `GET /applications/{id}/timeline` | page | page 이벤트 |
| `POST /applications/{id}/resume-run` 🔑 | `ai` | 202 `RESUME_WORKFLOW`. ai |
| `GET /applications/{id}/checklist` | – | 체크리스트 |
| `POST /applications/{id}/submission-drafts` 🔑 | `expectedRevision*`, `mode*`(`MANUAL_RECORD\|ADAPTER`), `adapter`, `documentVersionIds[]`(1개 이상), `confirmedSubmitted` | 201. 확정 안 된 문서가 있으면 422 `DOCUMENT_NOT_FINALIZED` |
| `POST /applications/{id}/submissions` 🔑 | `expectedRevision*`, `draftId*`, `approvalId*` | 201. 409 `APPROVAL_STALE` |
| `GET /applications/{id}/submissions` | page | page |

stage: `DISCOVERED, PREPARING, READY, APPLIED, SCREENING, INTERVIEW, OFFER, ACCEPTED, REJECTED, WITHDRAWN`

끝 단계 `ACCEPTED|REJECTED|WITHDRAWN`에서 다시 바꾸면 409 `INVALID_TRANSITION`이다.

### 3.8 documents

대부분 core다. `POST .../revisions`와 `GET .../export`만 ai다. `POST .../generate`는 core가 작업을 넣는다.

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /documents` | page, `applicationId`, `kind`, `archived=1`(최근 30일 안 보관 서류. `archivedAt`, `purgeAt`=보관 시각+30일. 이 목록에만 있음) | page |
| `POST /documents` 🔑 | `applicationId*`, `title*`(1–300), `kind*`(`RESUME\|PORTFOLIO\|COVER_LETTER\|CAREER_STATEMENT\|HUB_PROFILE`), `language*`, `template` | 201. 저장 template은 alias를 적용한 값 |
| `GET` · `PATCH /documents/{id}` | PATCH: `expectedRevision*`, `title`, `template`, `language` | Document |
| `GET /documents/{id}/versions[/{versionId}]` | page | Version |
| `POST /documents/{id}/versions` 🔑 | `expectedRevision*`, `content*`, `blocks[{id, text, evidenceRefs[{evidenceId, start, end}]}]`, `changeNote` | 201 `{document, version}` |
| `POST /documents/{id}/edits` 🔑 | `hunks[{sign, text}]`, `revisionId`(최신 버전 id, 선택) | 200 `{document, version}`. `sign` `+`·`-`가 아닌 줄은 문맥이다. 맞는 글이 없으면 409 `REVISION_CONFLICT`. OpenAPI에는 없고 core와 gateway `isCore`에 있다 |
| `POST /documents/{id}/generate` 🔑 | `expectedRevision*`, `evidenceIds[]`, `analysisId`, `ai`, `language` | 202 `DOCUMENT_GENERATE` |
| `POST /documents/{id}/revisions` 🔑 | `expectedRevision*`, `versionId*`, `selection*{from, to, text}`, `action*`(`REWRITE\|SHORTEN\|EMPHASIZE_METRICS\|CHANGE_TONE\|TAILOR_TO_JOB`), `instruction`, `ai` | 202 `DOCUMENT_REVISE`. ai |
| `POST /documents/{id}/revisions/{revisionId}/apply` 🔑 | `expectedRevision*` | `{document, version}` |
| `POST /documents/{id}/review` 🔑 | `versionId*` | `{quality, blocks}` |
| `POST /documents/{id}/finalize` 🔑 | `expectedRevision*`, `versionId*`, `approvalId*` | Document. 409 `UNSUPPORTED_CLAIM` |
| `POST /documents/{id}/archive` 🔑 | `expectedRevision*` | Document |
| `POST /documents/{id}/restore` 🔑 | `expectedRevision*`. `finalizedVersionId`가 있으면 `FINALIZED`, 없으면 `DRAFT`. revision 1 증가, 검색 색인 재삽입. 없거나 남의 서류거나 파기됐으면 404. revision 다르면 409. 보관 중이 아니면 200으로 그대로(#268, `0048`) | Document |
| `GET /documents/{id}/versions/{versionId}/export` | `format`(`PDF\|DOCX`), `template`, `photo` | 파일. ai. 확정된 버전만 |
| `POST` · `GET /documents/{id}/exports` 🔑 | `versionId*`, `format*`, `rendererVersion*` | 201 Export |
| `POST /documents/{id}/exports/{exportId}/result` 🔑 | `sha256*`, `byteLength*`, `status*`(`SUCCEEDED\|FAILED`), `pageCount`, `validation{koreanText, links, atsText}`, `errorCode` | Export |
| `POST /documents/{id}/profile` 🔑 | `target`(`hub\|application`, 없으면 `application`), `applicationId`, `expectedRevision` | 200. 기본은 지원 서류용 프로필(kind `HUB_PROFILE`). `applicationId`가 없으면 허브 프로필을 고치지 않는다. `target=hub`만 `base-profile`과 같은 쓰기로 허브 프로필을 바꾼다 |
| `POST /documents/{id}/base-profile` 🔑 | `{}` | 200 `{documentId, profileUserId}`. 서류 주인만. 제목·소개·경력·기술 스택을 바꾸고, 링크 제목이 있으면 링크도 바꾼다. 한 번에 써서 실패하면 예전 프로필이 남는다 |

`template`로 받는 값: `SIMPLE|MODERN|CREATIVE|ATS|CLASSIC|COMPACT`. `CLASSIC`은 `SIMPLE`, `COMPACT`는 `ATS`로 저장한다. 저장 값은 `SIMPLE|MODERN|CREATIVE|ATS` 네 개다. 확인 카드에는 `CLASSIC|MODERN|COMPACT|ATS`만 있고 `CREATIVE`는 없다.

### 3.9 career-evidence · sources

career-evidence 조회·생성·보관은 core, import는 ai, sources는 core, `profile-draft`만 ai다.

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /career-evidence` | page, `kind`, `query` | page Evidence |
| `POST /career-evidence` 🔑 | `kind*`(`RESUME\|GITHUB\|CAREER\|EDUCATION\|SKILL\|PROJECT`), `title*`(1–200), `sourceText*`(1–100000), `sourceUrl`, `skills[]`(≤100), `supersedesId` | 201 |
| `GET /career-evidence/{id}` | – | Evidence |
| `POST /career-evidence/import` 🔑 | `text*`, `contentHash*`, `format*`(`TEXT\|MARKDOWN\|PDF\|DOCX\|GITHUB`), `kind*`, `title*`, `sourceId`, `sourceUrl` | 202 `EVIDENCE_IMPORT` |
| `POST /career-evidence/{id}/archive` 🔑 | `expectedRevision*` | Evidence |
| `POST /sources` 🔑 | multipart `kind*` 비어 있지 않은 문자열, `file*` ≤20MiB. MIME `application/pdf`, docx, `text/plain`, `text/markdown`, `application/octet-stream` | 201 `{id, fileName, mimeType, size, sha256, status:"STORED", jobId}`. ingest 작업을 넣는다. `kind`는 저장하지 않는다. `origin` 기본값은 `UPLOAD` |
| `GET /sources` | page, `kind`(`UPLOAD\|AI`만. 없으면 둘 다) | 출처와 문서를 합쳐 최신순. AI 문서는 `origin:"AI"`, `mimeType:"application/json"`, `size:0`. 파일 이름이 `.md`로 끝나거나 mime이 `text/markdown`이면 뺀다 |
| `GET /sources/{id}` · `GET /sources/{id}/content` | – | Source / 원본 바이트 |
| `DELETE /sources/{id}` | – | 204. 경력 근거에 막히면 409 `INVALID_TRANSITION`, `details.reason`=`REFERENCED_BY_EVIDENCE`, `details.evidenceCount`(#268) |
| `GET /sources/{id}/profile-draft` | – | ai |

경력 근거 kind와 채팅 업로드의 multipart `kind`는 다른 값이다. 목록 쿼리 `kind`도 다르다.

### 3.10 projects

조회·실행·근거 쓰기는 core, `POST /projects/blueprints`와 verify는 ai다.

| 메서드·경로 | 요청 |
|---|---|
| `GET /projects`, `GET /projects/{id}` | page, `applicationId` |
| `POST /projects/blueprints` 🔑 | `applicationId*`, `gapAnalysisId*`, `ai` → 202 `PROJECT_BLUEPRINTS` |
| `POST /projects/{id}/select` 🔑 | `expectedRevision*` → `{blueprint, manifest}` |
| `GET` · `POST /projects/{id}/runs` 🔑 | `provider*`(`CODEX\|CLAUDE_CODE\|GROK_BUILD`), `workingDirectory*`(절대 경로), `prompt*` |
| `POST .../runs/{runId}/start` 🔑 | `expectedRevision*`, `approvalId*`, `detectedVersion*`, `deviceId*` |
| `POST .../runs/{runId}/launch` 🔑 | `expectedRevision*`, `deviceId*`, `payloadHash*`, `launchStatus*`(`CLAIMED\|STARTED\|UNKNOWN`), `process{pid, startedAt}` |
| `POST .../runs/{runId}/recover` 🔑 | `expectedRevision*`, `deviceId*`, `decision*`(`REATTACH\|MARK_FAILED`), `failureReason`, `process` |
| `POST .../runs/{runId}/result` 🔑 | `expectedRevision*`, `exitCode*`, `stdoutHash*`, `stderrHash*`, `commitSha` |
| `GET` · `POST /projects/{id}/evidence` 🔑 | `runId*`, `commitUrl*`, `testCommand*`, `testOutput*`, `exitCode*`, `summary*`, `metrics[]` |
| `POST /projects/{id}/evidence/{evidenceId}/verify` 🔑 | `expectedRevision*` → 202 `PROJECT_VERIFY` |

run state: `DRAFT, APPROVAL_REQUIRED, RUNNING, VERIFYING, VERIFIED, FAILED`

### 3.11 interviews (core, prepare는 ai)

| 메서드·경로 | 요청 |
|---|---|
| `GET /interviews` | page, `applicationId`, `from`, `to` |
| `POST /interviews` 🔑 | `applicationId*`, `title*`, `scheduledAt*`, `timeZone*`(IANA), `durationMinutes`, `evidenceIds[]`, `companySources[≤10]`, `notes` |
| `GET` · `PATCH /interviews/{id}` | `expectedRevision*`, `title`, `scheduledAt`, `companySources`, `notes`, `reflection` |
| `POST /interviews/{id}/prepare` 🔑 | `expectedRevision*`, `ai` → 202 `INTERVIEW_PREPARE` |

### 3.12 calendar (core)

| 메서드·경로 | 요청 |
|---|---|
| `GET /calendar/events` | `from*`, `to*`(기간 ≤366일), `applicationId`, page |
| `POST /calendar/events` 🔑 | `type*`(`INTERVIEW\|DEADLINE\|FOLLOW_UP\|CUSTOM\|COFFEE_CHAT`), `title*`, `startsAt*`, `endsAt*`, `timeZone`, `notes`, `remindAt`, `applicationId` |
| `PATCH /calendar/events/{id}` | `expectedRevision*`, `title`, `startsAt`, `endsAt`, `timeZone`, `notes` |
| `DELETE /calendar/events/{id}` | 본문 `expectedRevision*` → 204 |

### 3.13 integrations

Google은 core, `GET /integrations/job-sites`는 gateway다.

| 메서드·경로 | 요청 |
|---|---|
| `GET` · `DELETE /integrations/google` | 상태 조회 / 연결 해제(204) |
| `POST /integrations/google/connect` 🔑 | `codeChallenge*`, `codeChallengeMethod*`=S256, `redirectUri*` |
| `GET /integrations/google/callback` | 공개, 302 |
| `POST /integrations/google/complete` 🔑 | `integrationCode*`, `codeVerifier*` |
| `POST /integrations/google/sync` 🔑 | → 202 `GOOGLE_SYNC` |
| `GET /integrations/google/messages` | page, `applicationId`. Gmail 베타 플래그가 꺼져 있으면 403 |
| `GET /integrations/google/events` | page, `from`, `to` |
| `POST /integrations/google/messages/{id}/link` 🔑 | `applicationId*` |
| `GET /integrations/job-sites` | `[{provider(WANTED\|JUMPIT\|JOBKOREA), enabled, permissionVerified, mode:"MANUAL_CHECKLIST", ...}]` |

### 3.14 ai · 모델 경로

| 메서드·경로 | 담당 | 요청 | 응답 |
|---|---|---|---|
| `GET /ai/models` | gateway | `provider` | `[{provider, model, label, available, supportedEfforts}]` |
| `GET /ai/usage` | core | page, `from`, `to` | page `{provider, model, inputTokens, outputTokens, costMicroCredits, status}` |
| `POST /ai/generate` 🔑 | ai | `prompt*`, `applicationId*`, `ai*`, `evidenceIds[]` | 202 `AI_GENERATE` |
| `GET /ai/jobs/{id}` | core | – | 작업 한 건 |

모델 호출은 OpenRouter다. 키는 `OPENROUTER_API_KEY`이고 기본 주소는 `https://openrouter.ai/api/v1`이다. `OPENAI_API_KEY`는 쓰지 않는다. 카탈로그와 사용량 행의 `provider: OPENAI`는 계열 이름이고, 요청은 OpenRouter로 간다. 계열 enum은 `OPENAI|OPENROUTER|CLAUDE|GEMINI|GROK`다. 클라이언트가 보낸 provider와 model은 저장했다가 요금제 레버가 무시한다. 사용량 행의 provider 문자열은 `OPENAI`로 남는다.

예외. 모델 id가 `opencode-go/`로 시작하면 `OPENCODE_GO_API_KEY`와 `https://opencode.ai/zen/go/v1`을 쓴다. 그 키가 없으면 "OpenCode Go is not configured"다. 임베딩은 `EMBEDDING_API_KEY`가 있으면 그 키, 없으면 `OPENROUTER_API_KEY`다.

키가 없을 때

- 요청에 `ai`가 있고 `MANAGED_AI`가 꺼져 있으면 큐에 넣기 전에 503 `NOT_CONFIGURED` "managed AI is not configured"다. fo-mobile은 `ai`를 보내지 않아서 이 분기를 타지 않는다.
- 모델 호출에 들어갈 키가 비어 있으면 오류 이벤트 하나와 `finish FAILED` `NOT_CONFIGURED`다. 워커는 ack하고 지연 재시도를 하지 않는다. 다른 예외는 attempt가 3 미만이면 다시 넣는다.
- 요청에 `ai`가 없고 키도 없으면 기본 모델을 고르지 못해 StubModel로 돈다. 이 경로는 `NOT_CONFIGURED`를 내지 않는다.
- SDK `ChatOpenAI`는 timeout 60초, `max_retries=1`이다. provider 오류는 큐 재시도 없이 작업을 실패시킨다.

요금제 레버. 클라이언트 `effort`는 아래 값으로 덮인다. 무료 DeepSeek은 OpenRouter `provider.order` `Together,Fireworks,Novita`, `provider.ignore` `DeepSeek`이다(`OPENROUTER_DEEPSEEK_PROVIDERS`).

| 대상 | 요금제 | 모델 | effort | 참고 범위 | 월 마이크로 |
|---|---|---|---|---|---|
| 개인 | FREE | `deepseek/deepseek-v4.1-flash` | LOW | basic | 1,800,000 |
| 개인 | PRO | `anthropic/claude-sonnet-5-5` | MEDIUM | extended | 27,000,000 |
| 개인 | ULTRA | `anthropic/claude-opus-5-5` | HIGH | full | 108,000,000 |
| 기업 | 없음·BASIC | `anthropic/claude-sonnet-5-5` | MEDIUM | extended | 0 / 18,000,000 |
| 기업 | PRO | `anthropic/claude-opus-5-5` | HIGH | full | 90,000,000 |
| 기업 | ULTRA | `anthropic/claude-fable-5-1` | MAX | full | 180,000,000 |

`allowChat`은 요청에 `ai`가 있을 때만 돈다. 한도는 `users.plan`을 개인 표(FREE 1,800,000 / PRO 27,000,000 / ULTRA 108,000,000)에 맞춘다. 표에 없는 plan은 0이라 바로 403 `FEATURE_DISABLED`다. `ai`가 없으면 이 한도 검사를 건너뛴다. 회사 정보 검색은 `web_search=True`(OpenRouter `:online`)다. 기업 대화는 요청에서 모델을 고르지 않고 회사 요금제로 정한다. 면접 준비는 Pro부터, 기업 PDF 첨부는 Ultra다. 잠기면 403 `PLAN_REQUIRED`(`details.requiredPlan`).

### 3.15 billing (core)

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /billing` | – | 아래. 개인 또는 기업 멤버. 기업인데 회사가 없으면 404 |
| `POST /billing/checkout` 🔑 | `planId*` 기업 `BASIC\|PRO\|ULTRA`만. interval 없음 | 200 `{url, expiresAt}`. 기업 관리자만. 개인과 비관리자는 403. 다른 planId는 400 `details.field=planId`. Stripe `mode=subscription`, quantity 1, 가격 `STRIPE_PRICE_EMPLOYER_*`. 코드는 recurring interval을 넣지 않는다. 크레딧 주기는 UTC 월이다. OpenAPI enum에는 개인 `PRO\|ULTRA`가 남아 있지만 핸들러는 거절한다 |
| `POST /billing/topup` 🔑 | `amount*` 정수 1–100000 | 200 `{url}`만. 기업 관리자만. 개인은 403. `amount`는 `STRIPE_PRICE_TOPUP` 수량. 메타 `amountMicroCredits = amount * 6000`, audience `EMPLOYER`. `mode=payment`. 크레딧은 Stripe webhook이 회사 원장에 넣는다 |
| `POST /billing/iap/verify` 🔑 | `platform*`(`APP_STORE\|GOOGLE_PLAY`), `productId*`. Apple은 `signedTransaction`, Google은 `purchaseToken` | 200 `{plan, periodEndsAt}`. 사용자는 가리지 않고 `users`에 쓴다. 구독 상품은 plan, `subscription_status=ACTIVE`, `period_ends_at`, 원장 `PURCHASE`(개인 월 지급량). 소모 상품은 plan을 바꾸지 않고 `iapTopupMicro`(기본 300크레딧)를 더한다. 구독이 `ACTIVE`이고 `stripeCustomerId`가 있으며 상품이 topup이 아니면, 스토어 확인 전에 409 `ALREADY_SUBSCRIBED`. 같은 거래·같은 사용자는 멱등. 다른 계정이면 409 `CONFLICT` "purchase belongs to another account". 만료면 400 "purchase is not valid" |
| `POST /billing/portal` 🔑 | – | 200 `{url}`. `users.stripe_customer_id`가 있는 사용자. 없으면 409 `INVALID_TRANSITION` "no billing account". 회사 row의 고객 id는 보지 않는다. 관리자 검사가 없다. 돌아오는 주소는 `STRIPE_PORTAL_RETURN_URL`. 요금제를 내리는 전용 경로는 없다 |
| `GET /billing/ledger` | page, limit 1–100 기본 50 | 개인 원장 또는 회사 원장. 기업인데 회사가 없으면 404. 항목 `{id, type, amountMicroCredits, balanceAfter, referenceId, createdAt}` |
| `POST /billing/webhook` | 공개. `Stripe-Signature`, 허용 오차 300초, HMAC SHA-256 `v1` | `{received:true}`. `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, `customer.subscription.deleted`. `stripe_events`로 중복을 막는다. 서명이 나쁘면 400, 비밀이 없으면 503 |
| `POST /billing/webhook/app-store` | 공개. raw JWS 또는 `{signedPayload}` | 200 |
| `POST /billing/webhook/google-play` | 공개. JSON과 `Authorization: Bearer` OIDC RS256. iss `https://accounts.google.com`, aud `GOOGLE_OIDC_AUDIENCE` | 200 |

`GET /billing` 필드: `subscriptionStatus`, `plan`, `periodEndsAt`, `balanceMicroCredits`, `reservedMicroCredits`, `monthlyMicroCredits`, `spentMicroCredits`, `audience`, `source`. `usagePercent`와 리셋 날짜는 없다. 잔액은 최신 원장 `balance_after`에서 정산된 `ai_usage`와 열린 `credit_reservations`를 뺀 값이다. `reservedMicroCredits`는 `RESERVED` 합이다. `spentMicroCredits`는 이번 UTC 월에 정산된 사용량이다. 기업 `periodEndsAt`은 항상 null이다. 개인 `periodEndsAt`은 구독 종료다. 개인 `source`는 활성 인앱이면 `APP_STORE|GOOGLE_PLAY`, 아니면 구독이 `ACTIVE`일 때 `STRIPE`, 아니면 null이다. 기업 `source`는 plan이 있으면 `STRIPE`, 없으면 null이다. 화면 퍼센트는 `spentMicroCredits / monthlyMicroCredits`로 계산한다.

스토어 webhook은 해지 때 원장 행을 넣지 않는다. `REFUND|EXPIRED|REVOKE|GRACE_PERIOD_EXPIRED`는 `iap_subscriptions.status=CANCELED`, 사용자 plan `FREE`, `subscription_status=CANCELED`다. `PURCHASE|RENEWAL|SUBSCRIBED|DID_RENEW`는 그 거래 id가 이미 claim된 뒤에만 크레딧 또는 plan과 `PURCHASE`를 넣는다. 모르는 type은 200이고 쓰지 않는다. `iap_subscriptions` 행이 없는 첫 구매는 무시한다.

### 3.16 experiments (core)

`GET /experiments/{key}/assignment` · `POST /experiments/{key}/events` 🔑 `{event*}` → 201 · `GET /experiments/{key}/stats` · `GET /experiments/{key}/results`

### 3.17 봇 (core)

계약: `packages/contracts/spec/bots.ts`, `services/core-api/src/routes/bots.ts`.

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /bots` | – | 200 `{data: Bot[]}`. Push 봇을 없으면 만들고, Push 봇을 먼저, 회사 봇은 `updatedAt` 내림차순 |
| `POST /bots` 🔑 | 회사 봇 생성 | 201. 한도 초과 403 `BOT_LIMIT` |
| `POST /bots/link-preview` 🔑 | `{url}` | `found`면 `company`, `title`, `postingId`. 아니면 `{status:"not_a_posting"}` |
| `GET /bots/companies/search` | `q*` | `{name, openPostingCount}` 페이지 |
| `GET /bots/{id}` | – | Bot |
| `PATCH /bots/{id}` | `expectedRevision*`, `displayName`, `notificationsMuted`, `avatarKey`, `mascotKey` | Bot. 409 `REVISION_CONFLICT` |
| `DELETE /bots/{id}` | – | 회사 봇 소프트 삭제(`deleted_at`). Push 봇은 403 `DEFAULT_BOT_PROTECTED`. 204. 대화 행은 지우지 않음 |
| `GET /bots/{id}/conversations` | page | `bot_id`가 그 봇이고 보관되지 않은 대화, 커서 페이지 |
| `POST /bots/{id}/conversations` 🔑 | `{title}`(≤300), `applicationId`(선택) | 201. 참고 데이터 동의 없으면 403 `CONSENT_REQUIRED`. `conversations.bot_id`를 넣고 봇의 `company_id`, `posting_id`를 복사 |
| `POST /bots/{id}/read` 🔑 | `{readAt}` | `bot_read_markers` upsert |
| `GET /bots/{id}/library` | `limit`(기본 50, 최대 100), `section`(`conversations`\|`files`\|`links`), 커서 | 아래 |

`Bot`: `id`, `kind`(`push`\|`company`), `displayName`, `companyId`, `companyName`, `postingId`, `postingUrl`, `avatarKey`, `mascotKey`, `notificationsMuted`, `revision`, `createdAt`, `updatedAt`, `lastMessagePreview`(최대 140자), `unread`, `status`(`DONE`\|`RUNNING`\|`NEEDS_APPROVAL`).

Push 봇 id는 `push:bot:{userId}`의 UUID5, 표시 이름 `Push Bot`.

회사 봇 한도(Push 봇은 제외): FREE 3, PRO 20, ULTRA `null`(무제한). 알 수 없는 요금제는 FREE 3. ULTRA는 `limit === undefined`일 때만 FREE 3으로 떨어지던 `??` 버그를 고쳤다(#276). FREE·PRO 생성은 트랜잭션 안에서 `lock_timeout` 3초, `SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE` 후 count·INSERT. 락 타임아웃(55P03)은 429 `RATE_LIMITED`, `retryAfterSec` 1. 검증과 Push 봇 ensure는 트랜잭션 밖. 회사 이름 유니크는 없다. 같은 회사로 다시 POST하면 새 행. 기존 대화 `bot_id`는 `0052`가 채우지 않고, 새 대화만 `POST /bots/{id}/conversations`에서 연결.

라이브러리: `section` 없으면 세 칸 모두, 있으면 해당 섹션만 채우고 나머지는 빈 페이지. 커서 `conversationCursor`, `fileCursor`, `linkCursor`. 대화는 그 봇의 보관되지 않은 대화. 파일은 그 봇 대화에 붙은 source·document(마크다운 이름·mime 제외). 링크는 봇 `posting_url`과 같거나, 그 봇 대화 본문 URL이 들어 있는 `user_links`.

## 4. 채용 · 허브 · 소셜 · 회사

이 경로는 core다. gateway `isRecruiting`과 `isCore`에 등록돼 있다.

### 4.1 공고

기업 공고(`job_postings`, 마감되지 않은 것)를 찾는다. 모바일에는 공고 추가 화면이 없다. 모바일 내 공고는 에이전트에 붙여넣은 링크·본문으로 만든다(`jobs`, `sourceKind: URL|TEXT`).

#### `GET /postings`

게스트 가능. 토큰이 없으면 `bookmarked`와 `applied`는 false다.

| 쿼리 | 값 |
|---|---|
| `q` | 제목과 회사. 일반 부분 일치에 더해 초성, 입력 중인 자모, 영타도 받는다 |
| `category` | `dev\|data\|design\|plan\|marketing\|sales\|hr\|ops`. 쉼표로 여러 개 |
| `skills` | 쉼표로 여러 개 |
| `careerYears` | `0\|1-3\|4-6\|7-9\|10+`. 쉼표로 여러 개 |
| `location` | `시·도`, `시·도 구` 또는 `원격`. 쉼표로 여러 개 |
| `employmentType` | `full_time\|contract\|intern\|freelance\|dispatch`. 쉼표로 여러 개 |
| `sort` | `latest\|deadline\|popular`. `popular`는 전체 기간 `view_count`이고 cursor를 무시한다 |
| `deadlineWithin` | `7`만 |
| `limit`, `cursor` | page |

목록 항목: `{id, company, title, jobCategory, imageUrl, skills, careerMin, careerMax, location, employmentType, deadline, bookmarked, applied, sourceUrl, createdAt}`. `page.total`은 필터를 적용한 전체 개수다.

`status`는 `DRAFT|OPEN|CLOSED`다. 마감한 공고는 다시 열지 않는다.

#### `GET /postings/locations`

`GET /postings`와 같은 필터에서 지역 쿼리를 빼고 `[{location, count}]`를 준다.

#### `GET /postings/facets`

같은 필터로 패싯 개수를 준다.

#### `GET /postings/{id}`

목록 항목에 `description`, `requirements[]`, `preferred[]`, `workConditions`를 더한다. `sourceUrl`은 원문 링크다.

#### `POST /postings` 🔑

사업자 확인을 통과한 회사의 담당자가 아니면 403 "verified company required". 공고는 `company_id` 소유다.

`title*`(1–300), `jobCategory*`, `careerMin*`, `careerMax`, `location*`, `employmentType*`, `description*`(1–50000), `skills[]`, `requirements[]`, `preferred[]`, `workConditions`, `imageKey`, `deadline`, `sourceUrl`, `company`, `status`(`DRAFT|OPEN`)

#### `PATCH /postings/{id}` 🔑 · `POST /postings/{id}/close` 🔑

회사 소유만. 둘 다 `expectedRevision*`. revision이 다르면 409 `REVISION_CONFLICT` `{currentRevision}`. 마감은 `closed_at`을 기록한다.

#### `GET /companies/me/postings`

우리 회사 공고(마감 포함). `status`, page.

#### `POST /postings/{id}/bookmark` 🔑 · `DELETE` 같은 경로

반복해도 같다. 204.

#### `POST /postings/{id}/apply` 🔑

`documentIds[]`와 `sourceIds[]`. 기업 계정이면 403 "employer account required". 이미 지원했으면 기존 행을 201로 돌려준다. 최신 버전을 `application_snapshots`(`document_id`, `title`, `content`)에 복사하고 `sourceIds`는 `application_files`에 복사한다. 이벤트 payload는 `{postingId, documentIds}`다.

#### `POST /postings/{id}/fit` 🔑

`documentId*` → 202 `{jobId}`

#### 지원자

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /postings/{id}/applicants` | page, `stage` | page `[{applicationId, applicant:{displayName, headline, isNew}, stage, appliedAt}]`. `isNew`는 `company_seen_at`이 비어 있으면 참, 상세 첫 조회가 지운다. 다른 회사는 404 |
| `GET /postings/{id}/applicants/{applicationId}` | – | `{application, documents:[스냅샷], profileSource, capturedAt}`. `profileSource`는 `SUBMITTED\|CURRENT`. 지원 시 `applications.applicant_snapshot`에 headline, jobCategory, tenureYears, careers, skills, capturedAt을 넣는다(`0050`). 스냅샷 없으면 현재 프로필·`CURRENT`. email, displayName, hubProfileId는 항상 현재값(#269) |
| `GET /postings/{id}/applicants/{applicationId}/files/{fileId}` | – | 파일 |
| `GET /postings/{id}/applicant-counts` | – | 멤버만. 게스트는 404 |
| `PATCH /postings/{id}/applicants/{applicationId}` | `stage*`(`SCREENING\|INTERVIEW\|OFFER\|REJECTED`) | 200. `APPLICATION_STAGE` 알림 제목 "지원 상태가 바뀌었어요". 끝 단계에서 다시 바꾸면 409 `INVALID_TRANSITION` |

### 4.2 검색

| 메서드·경로 | 쿼리 | 응답 |
|---|---|---|
| `GET /search` | `q*`, `type`(`postings\|people\|posts`), 사람·게시글용 `category`, `tenure`, `status`, `explore`, page | type에 맞는 page. 게스트의 사람·게시글 검색은 401 |
| `GET /search/counts` | `q*` | 게스트 가능 |
| `GET /search/trending` | – | `{terms:[{term, count}]}` 최근 7일, 최대 8개, 열린 공고의 기술. 게스트 가능 |

검색마다 `search_queries`에 검색어만 넣는다. 사용자 id는 없다. 개인 최근 검색 목록과 모두 지우기는 없다. "이번 주 많이 본 공고" 경로는 없다. 게시글 `period=week`는 글 `created_at`이고 공고 조회수가 아니다.

허브 검색창은 `GET /profiles?q=`를 쓴다.

### 4.3 허브 · 마이

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /profiles` | `q`, `category`(쉼표), `tenure`(`0\|1-2\|3-5\|6-9\|10+`. 화면 라벨 신입·1–2년·3–5년·6–9년·10년+. 서버는 예전 `0-2`를 `[0,2]`로 거름), `status`(`satisfied\|seeking\|feedback`), `explore`(`recommended\|offers`), page | page Profile |
| `GET /profiles/{userId}` | – | Profile + `following`, `offered` |
| `POST /profiles/{userId}/offer` 🔑 | `message*`(1–500), `postingId` | 201. 다시 보내면 409 `CONFLICT`, 자기 자신에게 보내면 400 |
| `GET /me/offers` | `box*`=`received\|sent`, page | page Offer `{id, sender, recipient, message, posting, status(SENT\|READ\|ACCEPTED\|DECLINED), readAt, createdAt}` |
| `GET /me/offers/{id}` | – | Offer. 받은 제안이면 `READ`와 `readAt` |
| `POST /me/offers/{id}/accept` 🔑 | `reply`(선택) | Offer |
| `POST /me/offers/{id}/decline` 🔑 | – | Offer |
| `GET /me/offers/{id}/messages` | page | 당사자만 |
| `POST /me/offers/{id}/messages` 🔑 | `body*` | 201. `ACCEPTED`가 아니면 409 `CONFLICT` |
| `GET /me/links` | `kind`(`job\|github\|portfolio\|blog\|other`), page | page Link `{id, kind, url, title, status, fitCount, aiRead, createdAt}` |
| `POST /me/links` 🔑 | `url*`(자격증명 없는 http(s)), `kind`, `title`, `aiRead` | 201. kind를 생략하면 주소로 판별 |
| `PATCH /me/links/{id}` | `url`, `kind`, `title`, `aiRead` | 200 |
| `DELETE /me/links/{id}` | – | 204 |
| `POST /me/links/{id}/restore` 🔑 | – | 소프트 삭제 뒤 되돌림 |
| `POST /me/devices` 🔑 | `token*`(1–4096), `platform*`(`ios\|android`) | 201 `{token, platform}` |
| `DELETE /me/devices/{token}` | 경로 값이 토큰이다. OpenAPI 이름만 `{id}` | 204. 없어도 204 |
| `GET /me/notifications` | page | `{id, type(DEADLINE\|OFFER\|COMMENT\|AI_DONE\|APPLICATION_STAGE), title, body, target, readAt, createdAt}` |
| `GET /me/notifications/unread` | – | `{count}` |
| `POST /me/notifications/read` 🔑 | `all:true` 또는 `ids` | 읽음 |
| `GET` · `PATCH /me/settings` | 아래 | Settings |
| `POST /users/{userId}/follow` 🔑 · `DELETE` | – | 204. 자기 자신이면 400 |
| `GET /me/profile` · `PATCH /me/profile` | 아래 | Profile |
| `GET /me/bookmarks` | page | page Posting |
| `GET /me/follows` · `GET /me/followers` | page | page Profile |
| `GET /me/posts` | page | 내가 쓴 글 |
| `GET /me/commented-posts` | page | 댓글 단 글 |
| `GET /me/consents` | – | `{referenceData, updatedAt, terms}` |
| `PUT /me/consents` 🔑 | `referenceData*` bool | 200. false면 그 사용자의 `reference_samples`를 지운다 |
| `PUT /me/consents/terms` 🔑 | `age14`, `serviceTerms`, `privacy`, `marketing`, `termsVersion` | 200. 셋 중 하나라도 보내면 `age14`, `serviceTerms`, `privacy`가 모두 true여야 한다. 켠 뒤에는 끄지 못한다(400). `marketing`은 선택 bool. `termsVersion`은 1–64자, 없으면 `1.0`. 다른 버전이면 이전 행을 `user_consent_history`에 복사한 뒤 덮어씀(#267, `0049`). 같은 버전은 멱등. 가입 요청에는 저장하지 않는다 |

Settings 응답: `notifyDeadline`, `notifyOffer`, `notifyComment`, `notifyAiDone`, `notifyApplicationStage`(null이면 true), `locale`(`ko|en`), `profilePublic`, `careerStatusVisibility`(`everyone|followers|private`), `hideFromCurrentCompany`, `contactVisibility`(`accepted|followers|everyone|private`), `defaultTone`(`as_is|professional|confident|concise|technical|friendly`), `allowAiReadMyFiles`, `aiAccessMode`(`ALWAYS_ASK|AUTO|BYPASS`, null·빈 값은 `AUTO`). 잘못된 enum은 422 `VALIDATION_ERROR`, 잘못된 bool은 400 "must be a boolean"이다. `chatRetentionDays`, `defaultEffort`, `confirmBeforeEdit`는 응답에 없고 PATCH는 모르는 키를 무시한다.

Profile: `{userId, displayName, avatarUrl, headline, jobCategory, tenureYears, careerStatus, openToOffers, intro, careers, skills, followerCount, followingCount, postCount, resumeSourceId, contact, updatedAt}`. 상세는 `following`, `offered`를 더한다. PATCH 필드는 `displayName`, `avatarKey`, `headline`, `jobCategory`, `tenureYears`, `careerStatus`, `openToOffers`, `intro`, `careers[{company, role, startedOn, endedOn, description}]`, `skills[]`, `resumeSourceId`(본인 source), `contact`다. 서버가 관리하는 개수 필드를 넣으면 400 "server-managed field"다. 프로필이 없으면 404다.

별도 `/offers` 리소스는 없다.

### 4.4 소셜

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /posts` | `category`(`work\|dev\|daily\|career\|talk\|coffeechat\|marketing`), `q`, `sort`, `period`, page | page Post |
| `POST /posts` 🔑 | `category*`, `title*`(1–100), `body*`(1–5000), `imageKeys[≤4]` | 201 Post |
| `GET /posts/{id}` | – | Post |
| `GET /posts/{id}/comments` | page | page |
| `POST /posts/{id}/comments` 🔑 | `body*`(1–1000), `parentId` | 201 |

`Post`: `{id, author:{id, displayName}, category, title, body, imageUrls[], commentCount, viewCount, createdAt}`

### 4.5 이미지 (core)

`POST /uploads/images` 🔑 multipart `file*`(jpeg, png, webp, heic, ≤10MiB) → 201 `{key, url}`

`GET /uploads/images/{key}`는 공개다. DB에는 key만 저장한다.

### 4.6 회사

사업자 확인은 국세청 진위확인과 상태조회를 서버에서 호출한다.

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `POST /companies/verify` 🔑 | `bNo*`(10자리), `startDt*`(`YYYYMMDD`), `pNm*`, `bNm*` | 201 Company. 호출한 사람이 관리자. 불일치·휴업·폐업은 422 `BUSINESS_NOT_VERIFIED`(`details.reason`: `MISMATCH\|SUSPENDED\|CLOSED`). 이미 있으면 409 `COMPANY_EXISTS`. 기업 계정이 아니면 403 |
| `GET /companies/me` | – | `{id, bNo, name, plan, verifiedAt, role, seats:{used, limit}}` |
| `PATCH /companies/me` | `logoKey`, `industry`, `website`, `intro`, `representativeName` | 200 |
| `GET /companies/me/members` | – | `[{userId, email, role, joinedAt}]` |
| `POST /companies/me/invites` 🔑 관리자 | `email*` | 201. 자리 한도는 PRO 2, ULTRA 5, 그 밖(BASIC과 null 포함)은 0. 관리자는 수에 넣지 않는다. 넘으면 403 `SEAT_LIMIT` |
| `GET /companies/me/invites` | – | 멤버도 본다. 초대 목록 |
| `POST /companies/me/invites/{id}/resend` 🔑 관리자 | – | 토큰 갱신. 60초 안이면 429. 메일 실패 502, 옛 토큰 유지(#267) |
| `GET /companies/invites/{token}` | – | 공개. 만료 초대 미리보기 `{reason, companyName, inviterName, expiresAt}` |
| `POST /companies/invites/{token}/accept` 🔑 | – | 204. 기업 계정만. 이미 다른 회사면 409 |
| `DELETE /companies/me/members/{userId}` 🔑 관리자 | – | 204 |
| `PATCH /companies/me/members/{userId}` 🔑 관리자 | `role*`(`ADMIN`) | 204. 관리자는 한 명 |

재직 중인 회사를 이메일로 확인하는 경로는 없다.

### 4.7 기업 대화

- `POST /conversations`에 `audience:'EMPLOYER'`, `postingId`, `applicationId`. 목록은 `GET /conversations?audience=EMPLOYER`.
- 대화는 회사 소유다. 같은 회사 담당자가 함께 본다.
- Ultra PDF는 `POST /conversations/{id}/attachments`. 그 대화에만 붙고, 대화를 지우면 함께 지운다.
- 사업자 확인 전이면 403 `BUSINESS_NOT_VERIFIED`.
- 공고 초안은 메시지 안의 `posting-draft` 펜스다. 담당자가 고친 뒤 `POST /postings`로 등록한다.

## 5. DB

스키마는 push-be `db/migrations/0001_init.sql`부터 `0052_bots.sql`까지다. 라우트가 이 컬럼을 읽는다. 배포 절차는 이 문서가 적지 않는다. `0001`–`0046`은 이전 버전과 같다.

| 파일 | 요지 |
|---|---|
| `0047_ai_usage_reservation_gen.sql` | `ai_usage.reservation_gen`. 기본 1 |
| `0048_documents_purge_index_fit_cache_fk.sql` | 보관 서류 부분 인덱스, `posting_fit_cache` FK CASCADE |
| `0049_user_consent_history.sql` | 약관 버전 교체 전 동의 행 |
| `0050_application_applicant_snapshot.sql` | `applications.applicant_snapshot jsonb`, 기존 행 NULL |
| `0051_conversation_list_ai_jobs.sql` | 대화 목록용 `ai_jobs` 부분 인덱스. API 필드 변경 없음(#272) |
| `0052_bots.sql` | `bots`, `bot_read_markers`, `conversations.bot_id`. 기존 대화 UPDATE 없음 |

적용 메모(2026-11-11): `0047`–`0052`는 staging에 적용됐고 prod에는 아직 없다는 운영 메모가 있다. 이 저장소와 GitHub PR 본문만으로는 Neon 적용 로그를 확인하지 못했다(#269 머지 시점 본문은 staging·prod 모두 미적용). 적용 완료를 배포 절차처럼 단정하지 않는다.

## 6. 남은 차이

- fo-web 운영 Origin이 CORS 허용 목록에 없다.
- 개인 최근 검색 목록과 모두 지우기가 없다. 많이 찾는 검색어는 `GET /search/trending`이다.
- "이번 주 많이 본 공고" 경로가 없다. `sort=popular`는 전체 기간 조회수다.
- 서류 보관은 `POST /documents/{id}/restore`, 내 링크는 `POST /me/links/{id}/restore`로 되돌린다. 경력 근거(source) 삭제는 되돌리는 경로가 없고, 근거가 참조하면 409다.
- 별도 `/offers` 리소스는 없다. 허브 제안은 4.3이다.
- 재직 회사 이메일 인증 API가 없다.
- 요금제를 내리는 전용 경로가 없다. 포털은 사용자 Stripe 고객 id만 연다.
- `GET /billing`에 `usagePercent`와 리셋 날짜 필드는 없다. 퍼센트는 `spentMicroCredits / monthlyMicroCredits`이고, 다시 채움은 UTC 월 지급이다.
