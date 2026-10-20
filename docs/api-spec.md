# Push API 명세

- 버전: 2.0
- 작성일: 2026-10-20
- 상태: 기존 API는 push-be `develop`(`a7db401`) 구현에서 정리했다. `🆕` 표시가 붙은 v2 백엔드는 **미확정 설계안**이다(엔드포인트, 테이블, 담당 Worker 모두 바뀔 수 있다).
- 이전 버전: `docs/api.md` (커밋 `72fe539`에서 삭제)
- 관련 문서: [PRD.md](PRD.md), [feature-spec.md](feature-spec.md)

## 1. 범위와 구성

- 클라이언트는 데스크톱(Tauri), 모바일(Expo), fo-web(WebView)이고 모두 같은 API를 쓴다.
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

### 3.2 auth (core, `GET /auth/me`만 gateway)
| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /auth/{google\|github}/start` | `codeChallengeMethod*`=S256, `codeChallenge*`, `redirectUri*` (`push://auth/callback` 또는 `http://localhost:5173/auth/callback`) | `{authorizationUrl, state, expiresAt}` |
| `GET /auth/{provider}/callback` | `code`, `state` | 302 → `{finalUri}?code=` |
| `POST /auth/exchange` | `code*`, `codeVerifier*` | `Session{accessToken, refreshToken, expiresIn, user}` |
| `POST /auth/refresh` | `refreshToken*` | Session. refresh token을 새로 바꾼다. 폐기된 토큰을 다시 쓰면 그 사용자의 토큰을 전부 폐기한다. |
| `POST /auth/logout` | `refreshToken*` | 204 |
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
| `GET /billing` | – | `{subscriptionStatus, plan, periodEndsAt, balanceMicroCredits, reservedMicroCredits}` |
| `POST /billing/checkout` 🔑 | `planId*`(`PRO\|ULTRA`) | `{url, expiresAt}` |
| `POST /billing/portal` 🔑 | – | `{url}` |
| `GET /billing/ledger` | page | page `{type(PURCHASE\|REFUND), amountMicroCredits, balanceAfter, ...}` |
| `POST /billing/webhook` | 공개, `Stripe-Signature`(허용 오차 300초) | `{received:true}`. 이벤트 ID로 중복을 막는다. |

### 3.16 experiments (ai)
`GET /experiments/{key}/assignment` · `POST /experiments/{key}/events` 🔑 `{event*}` · `GET /experiments/{key}/stats` · `GET /experiments/{key}/results`

## 4. 🆕 v2 엔드포인트 (미확정 설계안)

### 4.1 공고 검색 (내 공고 + 기업 공고)

#### `GET /postings`
| 쿼리 | 값 |
|---|---|
| `q` | 제목과 회사에서 부분 일치로 찾는다(`pg_trgm`). |
| `kind` | `all`(기본) · `mine`(`jobs`, 본인) · `posted`(`job_postings`, 마감되지 않은 것) |
| `category` | 직군 키. 쉼표로 여러 개를 줄 수 있다. |
| `careerYears` | `0` · `1-3` · `4-6` · `7+` |
| `location` | 문자열 |
| `employmentType` | `full_time` · `contract` · `intern` · `part_time` |
| `limit`, `cursor` | page |

```json
{"data":[{"kind":"posted","id":"uuid","company":"","title":"","jobCategory":"dev",
  "careerMin":3,"careerMax":null,"location":"서울","employmentType":"full_time",
  "deadline":"2026-11-30","bookmarked":false,"applied":false,"sourceUrl":null,"createdAt":"..."}],
 "page":{"nextCursor":"...","hasMore":true}}
```

#### `GET /postings/{kind}/{id}`
목록 항목에 `description`과 `requirements[]`를 더해 돌려준다. `kind=mine`이면 본인 것만 볼 수 있고, 아니면 404다.

#### `POST /postings` 🔑
기업 공고를 만든다. `users.is_employer`가 아니면 403 `FORBIDDEN`이다.
요청 본문: `title*`(1–300), `jobCategory*`, `careerMin*`, `careerMax`, `location*`, `employmentType*`, `description*`(1–50000), `deadline`

#### `POST /postings/posted/{id}/bookmark` 🔑 · `DELETE` 같은 경로
같은 요청을 반복해도 결과가 같다. 응답은 204다.

#### `POST /postings/posted/{id}/apply` 🔑
기업 공고를 본인 `jobs`에 복사하고(`sourceKind: TEXT`) application을 만든다. 이미 지원했으면 기존 application을 돌려준다. 응답은 201 Application이다.

### 4.2 허브

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /profiles` | `q`, `category`(쉼표), `tenure`(`0-2\|3-5\|6-9\|10+`), `status`(`satisfied\|seeking\|feedback`), `explore`(`recommended\|offers`), page | page Profile |
| `GET /profiles/{userId}` | – | Profile + `following`, `offered` |
| `POST /profiles/{userId}/offer` 🔑 | `message*`(1–500), `postingId`(함께 보낼 공고) | 201. 다시 보내면 409 `CONFLICT`, 자기 자신에게 보내면 400 |
| `GET /me/offers?box=received\|sent` | page | page Offer `{id, sender, recipient, message, posting, status(NEW\|ACCEPTED\|DECLINED), readAt, createdAt}` |
| `GET /me/offers/{id}` | – | Offer. 받은 제안이면 읽음 처리 |
| `POST /me/offers/{id}/accept` 🔑 · `POST /me/offers/{id}/decline` 🔑 | 수락 시 `reply`(선택) | Offer |
| `POST /me/devices` 🔑 · `DELETE /me/devices/{token}` | `token*`, `platform*`(`ios\|android`) | 푸시 토큰 등록·해제 |
| `GET /me/notifications` · `POST /me/notifications/read` 🔑 | page / `ids[]` 또는 `all` | 알림함 목록 `{id, type(DEADLINE\|OFFER\|COMMENT\|AI_DONE), title, body, target, readAt, createdAt}` / 읽음 처리 |
| `GET` · `PATCH /me/settings` | 알림 스위치 4개, `profilePublic`, `careerStatusVisibility`, `contactVisibility`, `defaultTone`, `chatRetentionDays`, `allowAiReadMyFiles` | Settings |
| `POST /users/{userId}/follow` 🔑 · `DELETE` | – | 204. 자기 자신이면 400 |
| `GET /me/profile` · `PATCH /me/profile` | 섹션 단위 부분 수정: `displayName`, `avatarKey`, `headline`, `jobCategory`, `tenureYears`, `careerStatus`, `openToOffers`, `intro`, `careers[{company, role, startedOn, endedOn, description}]`, `skills[]`, `resumeSourceId`(본인 source만) | Profile |
| `GET /me/bookmarks` | page | page Posting |
| `GET /me/follows` | page | page Profile |
| `GET /me/posts` | page | page Post (내가 쓴 게시물) |

`Profile`: `{userId, displayName, avatarUrl, headline, jobCategory, tenureYears, careerStatus, openToOffers, intro, careers[], skills[], followerCount, resumeSourceId, updatedAt}`

### 4.3 소셜

| 메서드·경로 | 요청 | 응답 |
|---|---|---|
| `GET /posts` | `category`(`work\|dev\|daily\|career\|talk\|coffeechat\|marketing`, 생략하면 전체), page | page Post |
| `POST /posts` 🔑 | `category*`, `title*`(1–100), `body*`(1–5000), `imageKeys[≤4]` | 201 Post |
| `GET /posts/{id}` | – | Post |
| `GET /posts/{id}/comments` | page | page `{id, author, body, createdAt}` |
| `POST /posts/{id}/comments` 🔑 | `body*`(1–1000) | 201 |

`Post`: `{id, author:{id, displayName}, category, title, body, imageUrls[], commentCount, createdAt}`

### 4.4 이미지 업로드 (ai)
`POST /uploads/images` 🔑 · multipart `file*`(jpeg/png/webp/heic, ≤10MiB) → 201 `{key, url}`
- 로컬에서는 `storage_dir/images/`에 저장하고 `GET /uploads/images/{key}`로 제공한다. 배포할 때 R2로 바꾼다.
- DB에는 key만 저장한다.

### 4.5 라우팅 등록
- core `handler.ts`의 `dispatch`에 경로를 추가하고, gateway `routes/owner.ts`의 `isCore`에도 추가한다.
  - `/postings*`, `/profiles*`, `/users/*/follow`, `/me/*`, `/posts*`
- `/uploads/images`는 ai가 처리하므로 기본값(python) 그대로 둔다.

## 5. 🆕 DB 변경 (미확정 설계안, `db/migrations/0016_recruiting.sql`)

| 테이블 | 주요 컬럼 |
|---|---|
| `users` | `is_employer bool default false` 추가 |
| `job_postings` | `id, company_user_id, company, title, job_category, career_min, career_max, location, employment_type, description, requirements jsonb, deadline, closed_at, created_at` |
| `profiles` | `user_id pk, headline, job_category, tenure_years, career_status check(...), open_to_offers, intro, careers jsonb, skills jsonb, avatar_key, resume_source_id, created_at, updated_at` |
| `bookmarks` | `(user_id, posting_id) pk, created_at` |
| `follows` | `(follower_id, followee_id) pk, check(follower_id <> followee_id)` |
| `offers` | `id, sender_id, profile_user_id, message, created_at, unique(sender_id, profile_user_id)` |
| `posts` | `id, user_id, category check(...), title, body, image_keys jsonb, created_at` |
| `post_comments` | `id, post_id, user_id, body, created_at` |

인덱스
- `pg_trgm`: `job_postings(title, company)`, `jobs(title, company)`
- 목록 정렬용 `(…, created_at desc, id desc)`

마이그레이션은 배포에 포함되지 않는다. 운영 DB에는 수동으로 적용한다.

## 6. 알려진 차이

- 오퍼(`/offers`)는 v1 계약에 있었지만 아직 만들지 않았다. 허브 "제안"(`/profiles/{id}/offer`)과는 다른 기능이다.
- ai의 `routers/auth.py`, `billing.py`, `calendar.py`는 연결되어 있지 않다. 이 경로들은 core가 처리한다.
- `POST /ai/keys/{provider}/test`는 스텁이다.
- 문서 템플릿 enum은 `CLASSIC | MODERN | COMPACT`인데, 디자인은 심플·모던·크리에이티브·ATS 4종이다. 바꿔야 한다.
- 공고별 적합도(홈 배지, 공고 상세 카드)와 "이번 주 많이 본 공고"용 API가 없다.
