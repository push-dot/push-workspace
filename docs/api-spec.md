# Push API 명세

- 버전: 2.0
- 작성일: 2026-10-20
- 상태: 기존 API는 push-be `develop`(`a7db401`) 구현에서 정리했다. `🆕` 표시가 붙은 v2 백엔드는 **미확정 설계안**이다(엔드포인트, 테이블, 담당 Worker 모두 바뀔 수 있다).
- 이전 버전: `docs/api.md` (커밋 `72fe539`에서 삭제)
- 관련 문서: [PRD.md](PRD.md), [feature-spec.md](feature-spec.md)

## 1. 범위와 구성

- 클라이언트는 데스크톱(Tauri), 모바일(Expo), fo-web(기업·구직자 웹, 일부 화면은 앱 WebView)이고 모두 같은 API를 쓴다.
- 요청은 gateway Worker가 먼저 받아 아래처럼 나눈다.

| 담당 | 위치 | 처리하는 요청 |
|---|---|---|
| gateway | `services/gateway` | `/healthz`, `GET /auth/me`, `GET /conversations`, `GET .../messages`, `GET .../stream/active`, `GET /ai/models`, `GET /integrations/job-sites` |
| core | `services/core-api` | `routes/owner.ts`의 `isCore`에 있는 경로: auth, 대화 쓰기, jobs, calendar, ai keys·usage, billing, 🆕 v2 도메인 |
| ai | `services/ai` (Python) | `isAi` 경로(AI 실행, `/operations*`)와 그 밖의 경로 전부 |

- `/internal*` 경로는 gateway가 404로 막는다. 알 수 없는 경로는 ai로 넘어가 404 `NOT_FOUND`가 된다.
- 🆕 v2 경로는 core에 구현하고 `isCore`에 추가한다. 이미지 업로드만 ai가 맡는다.

## 2. 공통 계약

### 2.1 주소·형식
- 개발: `http://localhost:8080/api/v1` (ai uvicorn). gateway와 core는 `wrangler dev`로 띄운다.
- 운영: `https://push-be.<account>.workers.dev/api/v1`
- 요청과 응답은 UTF-8 JSON이고 필드 이름은 camelCase다. ID는 UUID, 시각은 RFC3339 UTC(마이크로초까지), 날짜는 `YYYY-MM-DD`다.
- ai 요청 스키마는 모르는 필드를 받지 않고 타입을 엄격하게 검사한다(`extra=forbid, strict`).
- 서버가 관리하는 필드(`userId`, `createdAt`, `revision` 등)를 요청 본문에 넣으면 거부한다.

### 2.2 인증
- 형식은 `Authorization: Bearer <accessToken>`이다. access token은 900초, refresh token은 30일 유효하다.
- 공개 경로
  - `GET /auth/{provider}/start|callback`
  - `POST /auth/exchange|refresh|logout`
  - `POST /auth/email/signup|verify|login|password-reset|password-reset/confirm` (v2 미확정)
  - `GET /postings`, `GET /postings/locations`, `GET /postings/{id}`: 토큰이 없으면 `bookmarked`·`applied`는 `false`다. `GET /search`는 토큰이 없으면 공고 탭 결과만 준다. (v2 미확정)
  - `POST /billing/webhook/app-store`, `POST /billing/webhook/google-play` (v2 미확정)
  - `POST /billing/webhook`
  - `GET /integrations/google/callback`
  - `/healthz`
- 다른 사용자의 리소스는 존재 여부를 드러내지 않고 404로 응답한다.
- 개발용 인증은 `APP_ENV=development`일 때 `DEV_AUTH_TOKEN`만 받는다.

### 2.3 응답
- 단건: `{"data": {...}}`
- 목록: `{"data": [...], "page": {"nextCursor": "...|null", "hasMore": bool}}`
  - `limit`은 1–100(기본 50)이고 `cursor`는 불투명한 값이다.
  - 정렬은 `createdAt DESC, id DESC`다.
- 비동기 작업은 202와 `Operation`을 돌려준다.
- 오류: `{"error": {"code", "message", "requestId", "details"}}`
  - `details`에는 복구에 필요한 값만 담는다. 예: `{field}`, `{currentRevision}`
- 모든 응답에 `x-request-id`가 붙는다. 클라이언트가 128자 이하로 보내면 그대로 돌려주고, 아니면 `req_<uuid>`를 새로 만든다.

| HTTP | code |
|---|---|
| 200 / 201 / 202 / 204 | 성공: 조회·수정 / 생성 / 비동기 접수 / 본문 없음 |
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED` |
| 403 | `FEATURE_DISABLED`, `FORBIDDEN` |
| 404 | `NOT_FOUND` (ai는 405도 `NOT_FOUND`로 돌려준다) |
| 409 | `REVISION_CONFLICT`, `INVALID_TRANSITION`, `APPROVAL_REQUIRED`, `APPROVAL_STALE`, `UNSUPPORTED_CLAIM`, `INTEGRATION_REQUIRED`, `IDEMPOTENCY_CONFLICT`, `CONFLICT` |
| 413 | `PAYLOAD_TOO_LARGE` |
| 422 | `VERIFICATION_FAILED`, `DOCUMENT_NOT_FINALIZED` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL` |
| 502 | `PROVIDER_ERROR` |
| 503 | `NOT_CONFIGURED`, `TEMPORARILY_UNAVAILABLE` |

### 2.4 동시성·멱등성
- **revision**: 버전이 있는 리소스의 PATCH와 상태를 바꾸는 POST·DELETE에는 `expectedRevision`이 필요하다.
  - 값이 다르면 409 `REVISION_CONFLICT`와 `{currentRevision}`을 돌려준다.
  - 성공하면 revision이 1 올라간다.
- **Idempotency-Key**: 인증이 필요한 모든 POST에 UUID를 붙인다. `/stream`으로 끝나는 경로, 공개 경로, `/internal`은 예외다. PATCH, PUT, DELETE에는 쓰지 않는다.
  - 같은 사용자, 경로, 키에 같은 본문(SHA-256)을 보내면 저장된 응답을 그대로 돌려준다.
  - 본문이 다르거나 처리 중이면 409 `IDEMPOTENCY_CONFLICT`다.
  - 2xx가 아닌 응답이 나면 예약이 풀려서 같은 키를 다시 쓸 수 있다. 5분 넘게 처리 중인 예약은 지운다.

### 2.5 한도
- **속도**
  - 인증 사용자: 분당 600회. gateway, core, ai가 Neon `rate_limits`를 함께 쓴다. gateway 읽기는 540회에서 멈춘다.
  - 공개 경로: IP당 분당 60회
- **본문**: ai는 20MiB가 넘으면 413이다. 필드별 제한은 각 엔드포인트에 적는다.
- **CORS 허용 Origin**: `tauri://localhost`, `http(s)://tauri.localhost`, localhost와 127.0.0.1(모든 포트). 🆕 fo-web 운영 도메인을 추가해야 한다.
- **허용 헤더**: `Authorization`, `Content-Type`, `Accept`, `Origin`, `Idempotency-Key`, `X-Request-Id`, `X-Byok-Key`

### 2.6 공통 타입
- `Operation`: `{id, type, applicationId, status, progress, result:{kind, value}, error, inputRequest, createdAt, updatedAt}`
  - status: `QUEUED | RUNNING | NEEDS_INPUT | SUCCEEDED | FAILED | CANCELLED`
- `AiOptions`: `{provider*, model*, credentialMode*, effort*, ultraResume, webSearch, models}`
  - provider: `OPENAI | OPENROUTER | CLAUDE | GEMINI | GROK`
  - credentialMode: `MANAGED | BYOK`
  - effort: `LOW | MEDIUM | HIGH | MAX`

## 3. 엔드포인트 (기존)

표 보는 법: `*`는 필수다. 🔑은 `Idempotency-Key`가 필요하다는 뜻이다. "page"는 목록 응답이다.

### 3.1 health (gateway)
| 메서드·경로 | 비고 |
|---|---|
| `GET /healthz` | 공개, 속도 제한 없음 → `{status:"ok"}` |
| `GET /api/v1/healthz` | 공개, IP당 분당 60회 |

### 3.2 auth (core, `GET /auth/me`만 gateway, 이메일 가입은 v2 미확정)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /auth/{google\|github}/start` | `codeChallengeMethod*`=S256, `codeChallenge*`, `redirectUri*` (`push://auth/callback` 또는 `http://localhost:5173/auth/callback`), `accountType`(`PERSONAL\|EMPLOYER`, 기본 `PERSONAL`) | `{authorizationUrl, state, expiresAt}`. GitHub에 `EMPLOYER`면 400 `VALIDATION_ERROR` |
| `GET /auth/{provider}/callback` | `code`, `state` | 302 → `{finalUri}?code=` |
| `POST /auth/exchange` | `code*`, `codeVerifier*` | `Session{accessToken, refreshToken, expiresIn, user}`. 제공사 이메일이 인증되지 않았으면 400 `EMAIL_NOT_VERIFIED`(GitHub은 `verified`인 기본 이메일만). 이메일이 다른 계정 종류로 이미 있으면 409 `EMAIL_TAKEN`(`details.accountType`) |
| `POST /auth/email/signup` | `email*`, `password*`(8–128), `accountType*`(`PERSONAL\|EMPLOYER`), `displayName*`, `consentReference`(bool) | 202. 인증 메일을 보낸다. 이메일이 이미 있으면 409 `EMAIL_TAKEN`(`details.accountType`) |
| `POST /auth/email/verify` | `token*` | Session. 이때 계정이 생긴다 |
| `POST /auth/email/login` | `email*`, `password*` | Session. 인증 전이면 403 `EMAIL_NOT_VERIFIED`, 틀리면 401 `INVALID_CREDENTIALS` |
| `POST /auth/email/password-reset` | `email*` | 202 (이메일 존재 여부를 드러내지 않는다) |
| `POST /auth/email/password-reset/confirm` | `token*`, `password*` | 204. 그 사용자의 refresh token을 모두 폐기한다 |
| `POST /auth/refresh` | `refreshToken*` | Session. refresh token을 새로 바꾼다. 폐기된 토큰을 다시 쓰면 그 사용자의 토큰을 전부 폐기한다. |
| `POST /auth/logout` | `refreshToken*` | 204 |
| `DELETE /me` 🔑 | – | 204. Stripe 구독을 바로 해지하고(실패하면 502, 탈퇴하지 않음) 토큰을 모두 폐기한 뒤 `users.deletion_requested_at`을 기록한다. 30일 안에 다시 로그인하면 복구된다. 인앱 결제 구독은 서버가 해지할 수 없으므로 탈퇴 확인 창에서 스토어 해지를 안내한다. 기업 관리자는 다른 담당자에게 관리자를 넘기기 전에는 탈퇴할 수 없다(409 `ADMIN_TRANSFER_REQUIRED`, 담당자가 없으면 회사도 함께 탈퇴 처리). 30일이 지나면 cron이 사용자 행을 지우고 관련 행은 FK cascade로 함께 지워진다(마이그레이션 0018). 유예 중에는 허브 프로필과 소셜 글이 목록·상세에서 빠진다 |
| `GET /auth/me` | – | `{id, displayName, locale, createdAt}`, ETag |

### 3.3 conversations (gateway 읽기 · core 쓰기 · ai 스트림)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /conversations` | page, `applicationId` | page `Conversation{id, revision, applicationId, title, pinned, createdAt, updatedAt}` |
| `POST /conversations` 🔑 | `title*`(≤300), `applicationId` | 201 Conversation |
| `PATCH /conversations/{id}` | `expectedRevision*`, `title`, `pinned` | Conversation |
| `POST /conversations/{id}/archive` 🔑 | `expectedRevision*` | Conversation. 이 대화에서만 쓰던 근거도 함께 보관한다. |
| `GET /conversations/{id}/messages` | page | page `Message{id, conversationId, role, text, attachments[], operationId, createdAt}` |
| `POST /conversations/{id}/messages` 🔑 | `text*`(1–20000), `accessMode*`(`SUGGEST\|CONFIRM_ACTIONS`), `context{documentId, versionId, evidenceIds[]}`, `ai`; 헤더 `X-Byok-Key` | 202 Operation `CHAT_MESSAGE` `{jobId}`. 403 `FEATURE_DISABLED`, 409 `INTEGRATION_REQUIRED` |
| `POST /conversations/{id}/messages/stream` | 위와 같은 본문 | SSE |
| `GET /conversations/{id}/messages/stream/active` | `after` 또는 `Last-Event-ID` | SSE, 진행 중인 작업이 없으면 204 |

**SSE(채팅)**
- 스트림은 `retry: 400`으로 시작한다.
- 각 프레임은 `id: <seq>`와 `data: {..., seq}`로 이루어진다.
  - `{type:"token", text}`
  - `{type:"status", text}`
  - `{type:"error", error:{code, message, details}}`
  - `{type:"done", operation}`
- gateway의 `/active`는 250ms마다 확인하고 최대 `SSE_MAX_POLLS`번 반복한 뒤 닫는다. 클라이언트는 `Last-Event-ID`로 이어서 받는다.

### 3.4 approvals (ai)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /approvals` | page, `applicationId`, `status` | page Approval |
| `POST /approvals` 🔑 | `kind*`, `targetId*`, `applicationId`, `targetRevision` | 201 Approval |
| `GET /approvals/{id}` | – | `{approval, target}` |
| `POST /approvals/{id}/decision` 🔑 | `expectedRevision*`, `decision*`(`APPROVED\|DENIED`) | Approval |

- kind: `EVIDENCE_USE | DOCUMENT_FINALIZE | APPLICATION_SUBMIT | CLI_EXECUTE`
- status: `PENDING | APPROVED | DENIED | EXPIRED | CONSUMED`. 기본 유효 기간은 24시간이다.

### 3.5 operations (ai)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /operations/{id}` | – | Operation |
| `POST /operations/{id}/input` 🔑 | `fields{}`(작업이 요청한 키만), `sourceId` | Operation |
| `POST /operations/{id}/cancel` 🔑 | – | Operation |
| `GET /operations/{id}/events` | – | SSE 스냅샷. `event: progress\|result\|error`, `data:{operationId, sequence, payload}` |

type: `EVIDENCE_IMPORT, JOB_ANALYSIS, DOCUMENT_GENERATE, DOCUMENT_REVISE, PROJECT_BLUEPRINTS, PROJECT_VERIFY, INTERVIEW_PREPARE, RESUME_WORKFLOW, AI_GENERATE, CHAT_MESSAGE, GOOGLE_SYNC, APPLICATION_SUBMIT`

### 3.6 jobs: 내 공고 (core · 분석은 ai)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /jobs` | page, `archived`, `query`(회사·제목 ILIKE) | page `Job{id, revision, company, title, sourceKind, sourceUrl, sourceText, requirements, preferred, keywords, risks, deadline, language, createdAt, updatedAt}` |
| `POST /jobs` 🔑 | `company*`(1–200), `title*`(1–300), `sourceKind*`(`URL\|TEXT\|DOM`), `sourceText*`(1–200000), `language*`, `sourceUrl`(URL·DOM일 때 필수, 자격증명 없는 http(s)), `requirements[]`, `preferred[]`, `deadline` | 201 Job |
| `GET /jobs/{id}` | – | Job |
| `PATCH /jobs/{id}` | `expectedRevision*`, `company`, `title`, `requirements`, `preferred`, `deadline`(null이면 지움) | Job |
| `GET /jobs/{id}/analyses` | page | page `GapAnalysis{matched, missing, preferredMissing, risks, fitScore, stale, ...}` |
| `POST /jobs/{id}/analyze` 🔑 | `applicationId*`, `expectedRevision*`, `evidenceIds[]`, `ai` | 202 `JOB_ANALYSIS` |

### 3.7 applications (ai)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /applications` | page, `stage`, `query` | page Application |
| `POST /applications` 🔑 | `jobId*`, `notes` | 201 |
| `POST /applications/import` 🔑 | `jobId*`, `stage*`(DISCOVERED 제외), `appliedAt*`, `confirmed`(true), `notes` | 201 |
| `GET /applications/{id}` | – | Application |
| `PATCH /applications/{id}` | `expectedRevision*`, `stage`, `notes`, `nextActionAt` | Application. APPLIED로 직접 바꾸면 `INVALID_TRANSITION` |
| `GET /applications/{id}/timeline` | page | page 이벤트 |
| `POST /applications/{id}/resume-run` 🔑 | `ai` | 202 `RESUME_WORKFLOW` |
| `GET /applications/{id}/checklist` | – | 체크리스트 |
| `POST /applications/{id}/submission-drafts` 🔑 | `expectedRevision*`, `mode*`(`MANUAL_RECORD\|ADAPTER`), `adapter`, `documentVersionIds[]`(1개 이상), `confirmedSubmitted` | 201. 확정 안 된 문서가 있으면 422 `DOCUMENT_NOT_FINALIZED` |
| `POST /applications/{id}/submissions` 🔑 | `expectedRevision*`, `draftId*`, `approvalId*` | 201. 409 `APPROVAL_STALE` |
| `GET /applications/{id}/submissions` | page | page |

stage: `DISCOVERED, PREPARING, READY, APPLIED, SCREENING, INTERVIEW, OFFER, ACCEPTED, REJECTED, WITHDRAWN`

### 3.8 documents (ai)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /documents` | page, `applicationId`, `kind` | page |
| `POST /documents` 🔑 | `applicationId*`, `title*`, `kind*`(`RESUME\|PORTFOLIO\|COVER_LETTER`), `language*`, `template`(`CLASSIC\|MODERN\|COMPACT`) | 201 |
| `GET` · `PATCH /documents/{id}` | PATCH: `expectedRevision*`, `title`, `template`, `language` | Document |
| `GET /documents/{id}/versions[/{versionId}]` | page | Version |
| `POST /documents/{id}/versions` 🔑 | `expectedRevision*`, `content*`, `blocks[{id, text, evidenceRefs[{evidenceId, start, end}]}]`, `changeNote` | 201 `{document, version}` |
| `POST /documents/{id}/generate` 🔑 | `expectedRevision*`, `evidenceIds[]`, `analysisId`, `ai`, `language` | 202 `DOCUMENT_GENERATE` |
| `POST /documents/{id}/revisions` 🔑 | `expectedRevision*`, `versionId*`, `selection*{from, to, text}`, `action*`(`REWRITE\|SHORTEN\|EMPHASIZE_METRICS\|CHANGE_TONE\|TAILOR_TO_JOB`), `instruction`, `ai` | 202 `DOCUMENT_REVISE` |
| `POST /documents/{id}/revisions/{revisionId}/apply` 🔑 | `expectedRevision*` | `{document, version}` |
| `POST /documents/{id}/review` 🔑 | `versionId*` | `{quality, blocks}` |
| `POST /documents/{id}/finalize` 🔑 | `expectedRevision*`, `versionId*`, `approvalId*` | Document. 409 `UNSUPPORTED_CLAIM` |
| `POST /documents/{id}/archive` 🔑 | `expectedRevision*` | Document |
| `GET /documents/{id}/versions/{versionId}/export` | `format`(`PDF\|DOCX`) | 파일. 확정된 버전만 가능 |
| `POST` · `GET /documents/{id}/exports` 🔑 | `versionId*`, `format*`, `rendererVersion*` | 201 Export |
| `POST /documents/{id}/exports/{exportId}/result` 🔑 | `sha256*`, `byteLength*`, `status*`, `pageCount`, `validation{koreanText, links, atsText}` | Export |

### 3.9 career-evidence · sources (ai) — career-evidence는 추후, sources는 이번 범위
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /career-evidence` | page, `kind`, `query` | page Evidence |
| `POST /career-evidence` 🔑 | `kind*`, `title*`(1–200), `sourceText*`(1–100000), `sourceUrl`, `skills[]`(≤100), `supersedesId` | 201 |
| `GET /career-evidence/{id}` | – | Evidence |
| `POST /career-evidence/import` 🔑 | `text*`, `contentHash*`, `format*`(`TEXT\|MARKDOWN\|PDF\|DOCX\|GITHUB`), `kind*`, `title*`, `sourceId`, `sourceUrl` | 202 `EVIDENCE_IMPORT` |
| `POST /career-evidence/{id}/archive` 🔑 | `expectedRevision*` | Evidence |
| `POST /sources` 🔑 | multipart `kind*`, `file*`(≤20MiB; pdf, docx, txt, md) | 201 `{id, fileName, mimeType, size, sha256, status}` |
| `GET /sources/{id}` · `/content` | – | Source / 원본 바이트 |
| `DELETE /sources/{id}` | – | 204. 근거가 참조 중이면 409 |

kind: `RESUME, GITHUB, CAREER, EDUCATION, SKILL, PROJECT`

### 3.10 projects (ai)
| 메서드·경로 | 요청 |
|---|---|
| `GET /projects`, `GET /projects/{id}` | page, `applicationId` |
| `POST /projects/blueprints` 🔑 | `applicationId*`, `gapAnalysisId*`, `ai` → 202 `PROJECT_BLUEPRINTS` |
| `POST /projects/{id}/select` 🔑 | `expectedRevision*` → `{blueprint, manifest}` |
| `GET` · `POST /projects/{id}/runs` 🔑 | `provider*`(`CODEX\|CLAUDE_CODE\|GROK_BUILD`), `workingDirectory*`(절대 경로), `prompt*` |
| `POST .../runs/{runId}/start` 🔑 | `expectedRevision*`, `approvalId*`, `detectedVersion*`, `deviceId*` |
| `POST .../runs/{runId}/launch` 🔑 | `expectedRevision*`, `deviceId*`, `payloadHash*`, `launchStatus*`, `process{pid, startedAt}` |
| `POST .../runs/{runId}/recover` 🔑 | `expectedRevision*`, `deviceId*`, `decision*`(`REATTACH\|MARK_FAILED`) |
| `POST .../runs/{runId}/result` 🔑 | `expectedRevision*`, `exitCode*`, `stdoutHash*`, `stderrHash*`, `commitSha` |
| `GET` · `POST /projects/{id}/evidence` 🔑 | `runId*`, `commitUrl*`, `testCommand*`, `testOutput*`, `exitCode*`, `summary*`, `metrics[]` |
| `POST /projects/{id}/evidence/{evidenceId}/verify` 🔑 | `expectedRevision*` → 202 `PROJECT_VERIFY` |

run state: `DRAFT, APPROVAL_REQUIRED, RUNNING, VERIFYING, VERIFIED, FAILED`

### 3.11 interviews (ai) — 추후

면접 준비는 추후에 진행한다. 코드는 이미 구현돼 있다.

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
| `POST /calendar/events` 🔑 | `type*`(`INTERVIEW\|DEADLINE\|FOLLOW_UP\|CUSTOM`), `title*`, `startsAt*`, `endsAt*`, `timeZone`, `notes`, `applicationId` |
| `PATCH /calendar/events/{id}` | `expectedRevision*`, `title`, `startsAt`, `endsAt`, `timeZone`, `notes` |
| `DELETE /calendar/events/{id}` | 본문 `expectedRevision*` → 204 |

### 3.13 integrations (ai · job-sites는 gateway)
| 메서드·경로 | 요청 |
|---|---|
| `GET` · `DELETE /integrations/google` | 상태 조회 / 연결 해제 |
| `POST /integrations/google/connect` 🔑 | `codeChallenge*`, `codeChallengeMethod*`, `redirectUri*` |
| `GET /integrations/google/callback` | 공개, 302 |
| `POST /integrations/google/complete` 🔑 | `integrationCode*`, `codeVerifier*` |
| `POST /integrations/google/sync` 🔑 | → 202 `GOOGLE_SYNC` |
| `GET /integrations/google/messages` | page, `applicationId`. Gmail 베타 플래그가 꺼져 있으면 403 |
| `GET /integrations/google/events` | page, `from`, `to` |
| `POST /integrations/google/messages/{id}/link` 🔑 | `applicationId*` |
| `GET /integrations/job-sites` | `[{provider(WANTED\|JUMPIT\|JOBKOREA), enabled, permissionVerified, mode:"MANUAL_CHECKLIST", ...}]` |

### 3.14 ai (gateway · core · ai)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /ai/models` | `provider`, `credentialMode`; `X-Byok-Key` | `[{provider, model, label, available, supportedEfforts}]` |
| `GET /ai/keys` | – | `[{provider, lastFour, configured, updatedAt}]` |
| `PUT /ai/keys/{provider}` | `key*`(≥8) | key |
| `DELETE /ai/keys/{provider}` | – | 204 |
| `POST /ai/keys/{provider}/test` 🔑 | – | `{valid, checkedAt, errorCode}`. 지금은 스텁이라 항상 `valid:false`다. |
| `GET /ai/usage` | page, `from`, `to` | page `{provider, model, managed, inputTokens, outputTokens, costMicroCredits, status}` |
| `POST /ai/generate` 🔑 | `prompt*`, `applicationId*`, `ai*`, `evidenceIds[]` | 202 `AI_GENERATE` |

### 3.15 billing (core)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /billing` | – | `{audience(PERSONAL\|EMPLOYER), source(STRIPE\|APP_STORE\|GOOGLE_PLAY), subscriptionStatus, plan, periodEndsAt, balanceMicroCredits, reservedMicroCredits}`. 기업이면 회사 기준 값 |
| `POST /billing/checkout` 🔑 | `planId*`(개인 `PRO\|ULTRA`, 기업 `BASIC\|PRO\|ULTRA`). 월간만 | `{url, expiresAt}`. 개인은 데스크톱용. 기업은 관리자만(아니면 403). 이미 다른 수단으로 구독 중이면 409 `ALREADY_SUBSCRIBED` |
| `POST /billing/topup` 🔑 (v2 미확정) | `amount*` | `{url}`. 크레딧 충전(Stripe). 모바일 충전은 소모성 인앱 상품으로 `iap/verify`를 쓴다 |
| `POST /billing/iap/verify` 🔑 (v2 미확정) | `platform*`(`APP_STORE\|GOOGLE_PLAY`), `signedTransaction`(App Store) 또는 `purchaseToken`(Google Play), `productId*` | `{plan, periodEndsAt}`. 구독·충전을 반영한다. 데스크톱 Stripe로 구독 중이면 409 `ALREADY_SUBSCRIBED` |
| `POST /billing/webhook/app-store` · `/billing/webhook/google-play` (v2 미확정) | 공개. App Store Server Notifications V2(JWS 검증), Google Play RTDN(Pub/Sub push) | 200. 같은 크레딧 원장에 기록한다 |
| `POST /billing/portal` 🔑 | – | `{url}` |
| `GET /billing/ledger` | page | page `{type(PURCHASE\|REFUND), amountMicroCredits, balanceAfter, ...}` |
| `POST /billing/webhook` | 공개, `Stripe-Signature`(허용 오차 300초) | `{received:true}`. 이벤트 ID로 중복을 막는다. |

### 3.16 experiments (ai)
`GET /experiments/{key}/assignment` · `POST /experiments/{key}/events` 🔑 `{event*}` · `GET /experiments/{key}/stats` · `GET /experiments/{key}/results`

## 4. 🆕 v2 엔드포인트 (미확정 설계안)

### 4.1 공고 검색

기업 공고(`job_postings`, 마감되지 않은 것)를 찾는다. 모바일에는 공고 추가 화면과 출처 필터가 없다. 모바일 내 공고는 AI 채팅에 붙여넣은 링크·본문으로 만든다(`jobs`, `sourceKind: URL|TEXT`). 내 공고(`jobs`)를 이 목록에 넣을지는 미결이다([PRD.md](PRD.md) 16장).

#### `GET /postings`
| 쿼리 | 값 |
|---|---|
| `q` | 제목과 회사에서 찾는다. 일반 부분 일치(`pg_trgm`)에 더해 초성("ㅁㅇㅍㅇ"), 입력 중인 자모("백ㅇ"), 영타("ahdkvpdl")도 받는다. 규칙은 feature-spec 0.1 |
| `category` | 직군 키(개발 · 데이터 · 디자인 · 기획 · 마케팅 · 영업 · 인사 · 경영지원, 8개). 쉼표로 여러 개를 줄 수 있다. |
| `skills` | 기술 이름. 쉼표로 여러 개를 줄 수 있다. |
| `careerYears` | `0`(신입) · `1-3` · `4-6` · `7-9` · `10+`. 쉼표로 여러 개를 줄 수 있다. |
| `location` | `시·도`, `시·도 구` 또는 `원격`. 쉼표로 여러 개를 줄 수 있다. |
| `employmentType` | `full_time`(정규직) · `contract`(계약직) · `intern`(인턴) · `freelance`(프리랜서) · `dispatch`(파견). 쉼표로 여러 개를 줄 수 있다. |
| `limit`, `cursor` | page |

```json
{"data":[{"id":"uuid","company":"","title":"","jobCategory":"dev","imageUrl":"https://...",
  "skills":["Kotlin"],"careerMin":3,"careerMax":null,"location":"서울 강남구","employmentType":"full_time",
  "deadline":"2026-11-30","bookmarked":false,"applied":false,"sourceUrl":null,"createdAt":"..."}],
 "page":{"nextCursor":"...","hasMore":true,"total":128}}
```

`page.total`은 필터를 적용한 전체 개수다("공고 N개", 시트의 "공고 N개 보기").

#### `GET /postings/locations`
`GET /postings`와 같은 필터 쿼리를 받아 지역별 공고 수를 돌려준다(`[{location, count}]`). 지역 시트 2단계의 구별 개수에 쓴다.

#### `GET /postings/{id}`
목록 항목에 `description`, `requirements[]`, 근무 조건 `workConditions`를 더해 돌려준다. fo-web `/postings/:id`와 같은 ID를 쓴다. `sourceUrl`은 "원문 보기" 링크다.

#### `POST /postings` 🔑
기업 공고를 만든다. 사업자 확인을 통과한 회사의 담당자가 아니면 403 `FORBIDDEN`이다. 공고는 회사 소유다(`company_id`), `company`는 회사 상호가 기본값이다.
요청 본문: `title*`(1–300), `jobCategory*`, `careerMin*`, `careerMax`, `location*`, `employmentType*`, `description*`(1–50000), `skills[]`, `imageKey`(대표 이미지, `POST /uploads/images`로 받은 key), `deadline`

#### `POST /postings/{id}/bookmark` 🔑 · `DELETE` 같은 경로
같은 요청을 반복해도 결과가 같다. 응답은 204다.

#### `POST /postings/{id}/apply` 🔑
요청 본문: `documentIds[]`(제출할 내 서류, 본인 것만)
기업 공고를 본인 `jobs`에 복사하고(`sourceKind: TEXT`) application을 만든다. 제출한 서류는 지원 시점 내용을 `application_snapshots`에 복사한다(지원자가 나중에 고치거나 지워도 기업은 제출한 그대로 본다). 기업 계정은 지원할 수 없다(403). 이미 지원했으면 기존 application을 돌려준다. 응답은 201 Application이다.

### 4.1.1 통합 검색

#### `GET /search`
| 쿼리 | 값 |
|---|---|
| `q*` | 검색어 |
| `type` | `postings` · `people` · `posts` |
| `limit`, `cursor` | page |

`type`에 따라 page Posting, page Profile, page Post를 관련도순으로 돌려준다. 홈·허브·소셜 검색이 함께 쓴다.

### 4.2 허브

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /profiles` | `q`, `category`(쉼표), `tenure`(`0-2\|3-5\|6-9\|10+`), `status`(`satisfied\|seeking\|feedback`), `explore`(`recommended\|offers`), page | page Profile |
| `GET /profiles/{userId}` | – | Profile + `following`, `offered` |
| `POST /profiles/{userId}/offer` 🔑 | `message*`(1–500), `postingId`(함께 보낼 공고) | 201. 다시 보내면 409 `CONFLICT`, 자기 자신에게 보내면 400 |
| `GET /me/offers?box=received\|sent` | page | page Offer `{id, sender, recipient, message, posting, status(SENT\|READ\|ACCEPTED\|DECLINED), readAt, createdAt}`. 받은 제안의 "새 제안"은 `SENT`다. 보낸 제안은 `SENT`(읽지 않음) → `READ`(읽음) → `ACCEPTED`(수락함) / `DECLINED`(거절함)로 보인다 |
| `GET /me/offers/{id}` | – | Offer. 받은 제안이면 `READ`로 바꾸고 `readAt`을 채운다 |
| `POST /me/offers/{id}/accept` 🔑 · `POST /me/offers/{id}/decline` 🔑 | 수락 시 `reply`(선택, 1:1 메시지의 첫 메시지가 된다) | Offer |
| `GET /me/offers/{id}/messages` | page | page OfferMessage `{id, offerId, sender, body, createdAt}`. 보낸 사람과 받은 사람만 볼 수 있다 |
| `POST /me/offers/{id}/messages` 🔑 | `body*` | 201 OfferMessage. `ACCEPTED`가 아니면 409 `CONFLICT` |
| `GET /me/links` | `kind`(`job\|github\|portfolio\|blog\|other`), page | page Link `{id, kind, url, title, status, fitCount, aiRead, createdAt}`. `status`: 공고는 `READING\|READ`, `fitCount`는 맞춤 횟수 |
| `POST /me/links` 🔑 · `DELETE /me/links/{id}` | `url*`(자격증명 없는 http(s)), `kind`(생략하면 서버가 주소로 판별), `title`, `aiRead`(GitHub이면 README·커밋을 읽어 둠) | 201 Link / 204. AI 채팅에 붙여넣은 공고 링크는 서버가 `job`으로 저장한다 |
| `POST /me/devices` 🔑 · `DELETE /me/devices/{token}` | `token*`, `platform*`(`ios\|android`) | 푸시 토큰 등록·해제 |
| `GET /me/notifications` · `POST /me/notifications/read` 🔑 | page / `ids[]` 또는 `all` | 알림함 목록 `{id, type(DEADLINE\|OFFER\|COMMENT\|AI_DONE), title, body, target, readAt, createdAt}` / 읽음 처리 |
| `GET` · `PATCH /me/settings` | 알림 스위치 4개, `locale`(`ko\|en`), `profilePublic`, `careerStatusVisibility`(`everyone\|followers\|private`), `hideFromCurrentCompany`, `contactVisibility`, `defaultTone`(`as_is\|professional\|confident\|concise\|technical\|friendly`), `chatRetentionDays`(요금제 한도 안), `allowAiReadMyFiles` | Settings |
| `POST /users/{userId}/follow` 🔑 · `DELETE` | – | 204. 자기 자신이면 400 |
| `GET /me/profile` · `PATCH /me/profile` | 섹션 단위 부분 수정: `displayName`, `avatarKey`, `headline`, `jobCategory`, `tenureYears`, `careerStatus`, `openToOffers`, `intro`, `careers[{company, role, startedOn, endedOn, description}]`, `skills[]`, `resumeSourceId`(본인 source만) | Profile |
| `GET /me/bookmarks` | page | page Posting |
| `GET /me/follows` | page | page Profile (팔로잉) |
| `GET /me/followers` | page | page Profile (팔로워) |
| `GET /me/posts` | page | page Post (내가 쓴 게시물) |
| `GET /me/commented-posts` | page | page Post (댓글 단 게시물) |

`Profile`: `{userId, displayName, avatarUrl, headline, jobCategory, tenureYears, careerStatus, openToOffers, intro, careers[], skills[], followerCount, resumeSourceId, updatedAt}`

### 4.3 소셜

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /posts` | `category`(`work\|dev\|daily\|career\|talk\|coffeechat\|marketing`, 생략하면 전체), page | page Post |
| `POST /posts` 🔑 | `category*`, `title*`(1–100), `body*`(1–5000), `imageKeys[≤4]` | 201 Post |
| `GET /posts/{id}` | – | Post |
| `GET /posts/{id}/comments` | page | page `{id, author, body, createdAt}` |
| `POST /posts/{id}/comments` 🔑 | `body*`(1–1000) | 201 |

`Post`: `{id, author:{id, displayName}, category, title, body, imageUrls[], commentCount, viewCount, createdAt}`

### 4.4 이미지 업로드 (ai)
`POST /uploads/images` 🔑 · multipart `file*`(jpeg/png/webp/heic, ≤10MiB) → 201 `{key, url}`
- 로컬에서는 `storage_dir/images/`에 저장하고 `GET /uploads/images/{key}`로 제공한다. 배포할 때 R2로 바꾼다.
- DB에는 key만 저장한다.

### 4.6 회사와 담당자 (미확정)
사업자 확인은 국세청 사업자등록정보 진위확인(`validate`)과 상태조회(`status`) API를 서버에서 호출한다([feature-spec.md](feature-spec.md) 17.1).

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `POST /companies/verify` 🔑 | `bNo*`(10자리), `startDt*`(`YYYYMMDD`), `pNm*`(대표자명), `bNm*`(상호) | 201 Company. 호출한 사람이 관리자가 된다. `valid≠01`이거나 `b_stt_cd≠01`이면 422 `BUSINESS_NOT_VERIFIED`(`details.reason`: `MISMATCH\|SUSPENDED\|CLOSED`). 이미 등록된 사업자번호면 409 `COMPANY_EXISTS`. 기업 계정이 아니면 403 |
| `GET /companies/me` 🔑 | – | `{id, bNo, name, plan, verifiedAt, role(ADMIN\|MEMBER), seats:{used, limit}}` |
| `GET /companies/me/members` 🔑 | – | `[{userId, email, role, joinedAt}]` |
| `POST /companies/me/invites` 🔑 관리자 | `email*` | 201. 초대 메일을 보낸다. 한도(Basic·요금제 없음 0, Pro 2, Ultra 5, 관리자 제외)를 넘으면 403 `SEAT_LIMIT` |
| `POST /companies/invites/{token}/accept` 🔑 | – | 204. 기업 계정만. 이미 다른 회사 소속이면 409 |
| `DELETE /companies/me/members/{userId}` 🔑 관리자 | – | 204 |
| `PATCH /companies/me/members/{userId}` 🔑 관리자 | `role*`(`ADMIN`) | 204. 관리자를 넘긴다(관리자는 한 명) |

### 4.7 지원자 관리 (미확정)
회사 소유 공고만 다룬다. 다른 회사 공고는 404다.

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /postings/{id}/applicants` 🔑 | page, `stage` | page `[{applicationId, applicant:{displayName, headline}, stage, appliedAt}]` |
| `GET /postings/{id}/applicants/{applicationId}` 🔑 | – | `{application, documents:[스냅샷]}` |
| `PATCH /postings/{id}/applicants/{applicationId}` 🔑 | `stage*`(`SCREENING\|INTERVIEW\|OFFER\|REJECTED`) | 200. 지원자의 application 단계를 바꾸고 `APPLICATION_STAGE` 알림을 보낸다. 끝 단계(`REJECTED` 등)에서 다시 바꾸면 409 `INVALID_TRANSITION` |

### 4.8 기업 AI (미확정)
기업 AI 대화를 기존 `/conversations`에 얹을지 따로 둘지는 구현할 때 정한다. 계약으로 정하는 것:
- 대화는 회사 소유다. 같은 회사 담당자가 함께 보고 이어서 쓴다.
- 첨부: `postingId`(참고 공고), `applicationId`(서류 검토), Ultra만 PDF 업로드. PDF는 그 대화에만 붙고 대화를 지우면 함께 지운다.
- 요금제 잠금은 403 `PLAN_REQUIRED`(`details.requiredPlan`). 면접 준비는 Pro부터, PDF 업로드는 Ultra.
- 사업자 확인 전이면 403 `BUSINESS_NOT_VERIFIED`.
- 회사 정보 검색은 ai 서비스의 `web_search=True`(OpenRouter `:online`)를 쓴다.
- 모델과 레버는 회사 요금제로 서버가 정한다. 요청에서 모델을 고르지 않는다.

### 4.9 참고 데이터 동의 (미확정)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /me/consents` 🔑 | – | `{referenceData: bool, updatedAt}` |
| `PUT /me/consents` 🔑 | `referenceData*` | 200. 끄면 그 사용자의 `reference_samples`를 지운다 |

### 4.5 라우팅 등록
- core `handler.ts`의 `dispatch`에 경로를 추가하고, gateway `routes/owner.ts`의 `isCore`에도 추가한다.
  - `/postings*`, `/search`, `/profiles*`, `/users/*/follow`, `/me/*`, `/posts*`, `/companies*`, `/auth/email/*`, `/billing/iap/*`, `/billing/webhook/*`
- `/uploads/images`는 ai가 처리하므로 기본값(python) 그대로 둔다.

## 5. 🆕 DB 변경 (미확정 설계안, `db/migrations/0016_recruiting.sql`)

| 테이블 | 주요 컬럼 |
|---|---|
| `users` | `is_employer bool default false`, `password_hash`, `email_verified_at` 추가 |
| `job_postings` | `id, company_id(→ companies, 기존 company_user_id를 바꾼다), company, title, job_category, career_min, career_max, location, employment_type, description, requirements jsonb, work_conditions jsonb, skills jsonb, image_key, deadline, closed_at, created_at` |
| `profiles` | `user_id pk, headline, job_category, tenure_years, career_status check(...), open_to_offers, intro, careers jsonb, skills jsonb, avatar_key, resume_source_id, created_at, updated_at` |
| `bookmarks` | `(user_id, posting_id) pk, created_at` |
| `follows` | `(follower_id, followee_id) pk, check(follower_id <> followee_id)` |
| `offers` | `id, sender_id, profile_user_id, message, posting_id, status check(SENT, READ, ACCEPTED, DECLINED), read_at, created_at, unique(sender_id, profile_user_id)` |
| `offer_messages` | `id, offer_id, sender_id, body, created_at` |
| `user_links` | `id, user_id, type check(posting, profile), url, title, created_at` |
| `posts` | `id, user_id, category check(...), title, body, image_keys jsonb, view_count, created_at` |
| `post_comments` | `id, post_id, user_id, body, created_at` |
| `companies` | `id, b_no unique, name, verified_at, plan check(BASIC, PRO, ULTRA) null, stripe_customer_id, created_at` |
| `company_members` | `(company_id, user_id) pk, user_id unique, role check(ADMIN, MEMBER), created_at` |
| `company_invites` | `id, company_id, email, token unique, expires_at, accepted_at` |
| `application_snapshots` | `id, application_id, document_id, title, content, created_at` |
| `reference_samples` | `id, source_user_id(on delete cascade), job_category, tenure_years, fit_score, part_scores jsonb, plan check(FREE, PRO, ULTRA), features jsonb, sentence_templates jsonb, created_at` |
| `user_consents` | `user_id pk, reference_data bool default false, updated_at` |
| `email_tokens` | `id, user_id, kind check(VERIFY, RESET), token_hash, expires_at, used_at` |
| `iap_subscriptions` | `id, user_id, platform check(APP_STORE, GOOGLE_PLAY), original_transaction_id unique, product_id, expires_at, status` |

인덱스
- `pg_trgm`: `job_postings(title, company)`, `jobs(title, company)`
- 검색용 파생 컬럼: `search_choseong`, `search_jamo` (저장할 때 core-api가 `es-hangul`의 `getChoseong`·`disassemble`로 채운다). 대상: `job_postings`, `jobs`, `profiles`(이름·헤드라인·기술), `posts`(제목·본문). 영타 입력은 검색 전에 `convertQwertyToHangul`로 바꿔서 함께 찾는다
- 목록 정렬용 `(…, created_at desc, id desc)`

마이그레이션은 배포에 포함되지 않는다. 운영 DB에는 수동으로 적용한다.

## 6. 알려진 차이

- 오퍼(`/offers`)는 v1 계약에 있었지만 아직 만들지 않았다. 허브 "제안"(`/profiles/{id}/offer`)과는 다른 기능이다.
- ai의 `routers/auth.py`, `billing.py`, `calendar.py`는 연결되어 있지 않다. 이 경로들은 core가 처리한다.
- `POST /ai/keys/{provider}/test`는 스텁이다.
- 문서 템플릿 enum은 `CLASSIC | MODERN | COMPACT`인데, 디자인은 심플·모던·크리에이티브·ATS 4종이다. 바꿔야 한다.
- 공고별 적합도(공고 상세에 들어갈 때 고른 서류 기준으로 자동 계산)와 "이번 주 많이 본 공고"용 API가 없다.
- 캘린더 이벤트 유형에 커피챗(`COFFEE_CHAT`)이 없다. 추가해야 한다.
- 대화는 보관(`archive`)만 있다. 모바일 ⋯ 메뉴의 대화 공유·삭제 API가 없다.
- 최근 검색어(모두 지우기 포함), 많이 찾는 검색어(1–8위), 많이 찾는 기술용 API가 없다.
- `POST /billing/checkout`에 기업 요금제(`BASIC`)와 audience가 없다. 크레딧 추가 구매("충전"), 요금제 낮추기, 매월 1일 크레딧 충전, 요금제별 AI 레버(모델·추론 강도·참고 범위) 적용, 역량 보완 프로젝트 개수 제한, 인앱 결제 검증·스토어 웹훅이 없다. 요금제 크레딧(월 300 / 5,000 / 20,000, 기업 3,000 / 15,000 / 30,000)을 마이크로크레딧 단위와 맞추는 일은 미결이다.
- gateway `services/gateway/src/models.ts`의 `EFFORTS`에 `MAX`가 없다(ai·core에는 있다).
- `POST /postings/{id}/apply`는 `documentIds`를 `application_events.payload`에만 남긴다. 스냅샷이 없다.
- 이메일·비밀번호 가입과 메일 발송이 없다. OAuth만 있다.
