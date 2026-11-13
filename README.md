<h1 align="center">Push</h1>

<p align="center">
  <strong>공고와 경력 근거를 한 계정에 두고, 서류와 지원 활동을 잇는 커리어 작업공간</strong>
</p>

---

**Push**는 개인용 모바일 앱, 개인·기업 웹, 그리고 그 뒤의 API로 이루어진다. 모바일에서 공고를 보고 봇(Push Bot 하나와 회사마다 봇 하나, 웹에서는 에이전트라 부른다)과 대화를 이어 가고, 웹에서는 같은 계정의 공고·허브·소셜과 기업 채용 업무를 다룬다. 이력서 워크플로는 서버의 단계 게이트를 거치고, 근거 검색은 pgvector로 한다.

이 저장소(`push-workspace`)는 제품 문서와 서브모듈 핀을 둔다. 앱 코드는 [push-fe](https://github.com/push-dot/push-fe), 웹·모바일 앱 저장소는 [fo-web](https://github.com/push-dot/fo-web)·[fo-mobile](https://github.com/push-dot/fo-mobile), API 코드는 [push-be](https://github.com/push-dot/push-be)에 있다. `.gitmodules`의 브랜치는 `develop`이다.

이 저장소가 핀한 서브모듈 커밋은 push-be `dd505bb`, push-fe `866b3f6`이다. push-fe는 앱 두 저장소(fo-mobile `a7213fc`, fo-web `9c2d680`)를 중첩 서브모듈로 핀한다. 앱 저장소 develop은 그 핀보다 앞설 수 있다. 이미 받은 클론은 `git submodule update --init --recursive`로 중첩 서브모듈까지 받는다. 동작의 기준은 각 서브모듈 develop이다.

## 아키텍처

```
fo-mobile (Expo) ── WebView ──► fo-web (Vite)
        │                            │
        └──────── /api/v1 ───────────┘
                       │
            gateway Worker (이름 push-be)
            ├─ 일부 읽기는 여기서 응답
            ├─ CRUD ──► core Worker (push-be-core) ──► Neon
            └─ AI 경로 ──► VPS FastAPI (AI_ORIGIN)
                              │
                         Redis Streams
                         ├─ ai-worker (LangGraph)
                         ├─ ingest-worker
                         └─ notify-worker
                              │
                         Neon Postgres + pgvector
```

| 저장소 | 역할 |
| --- | --- |
| [push-fe](https://github.com/push-dot/push-fe) | pnpm 워크스페이스. `apps/fo-mobile`(Expo), `apps/fo-web`(Vite), `packages/api-client`, `packages/design-system`, `packages/shared`. 앱 소스는 [fo-mobile](https://github.com/push-dot/fo-mobile), [fo-web](https://github.com/push-dot/fo-web)에 있다. |
| [push-be](https://github.com/push-dot/push-be) | npm 워크스페이스. gateway Worker `push-be`, core Worker `push-be-core`, Python 서비스 `services/ai`, OpenAPI `packages/contracts`, SQL `db/migrations`. |
| push-workspace | 서브모듈 핀, 제품 문서. `Makefile`은 서브모듈의 실행·테스트 명령을 묶고, `compose.yml`은 자체 호스팅 묶음이다. |

## 기술 스택

아래는 이 저장소가 핀한 서브모듈 기준이다.

| 영역 | 선택 |
| --- | --- |
| 모바일 | Expo SDK 58, React Native 0.88, Expo Router(Native Tabs, Stack. 봇 홈이 탭이고 봇 채팅·봇 프로필·자료는 탭 위 스택), React 19.3, TanStack Query 5, Zustand 5, `@expo/ui`, Noto Sans KR (`apps/fo-mobile/src/theme/fonts.ts`의 `NotoSansKR-Regular`·`Medium`·`SemiBold`·`Bold`·`ExtraBold`. 웹 토큰은 `packages/design-system/src/tokens.ts`의 `"Noto Sans KR", "Noto Sans"`) |
| 웹 | Vite 6, React 19.1, React Router 7, TanStack Query 5. 개발 서버 포트 5174 |
| 공통 클라이언트 | TypeScript, pnpm 11, Turborepo 2, ky(`@push/api-client`), es-hangul(`@push/shared`) |
| 엣지 | Cloudflare Workers. gateway Worker `push-be`, core Worker `push-be-core`. npm 패키지명은 각각 `push-be-front`, `push-be-core`. Wrangler 4, TypeScript 7, `@neondatabase/serverless` |
| AI | Python 3.12 이상. 이미지와 CI 상한은 3.15. FastAPI, LangGraph, uvicorn. Hostinger VPS의 Docker·Traefik 위에서 `ai-worker`, `ingest-worker`, `notify-worker`, `dispatcher`와 Redis Streams를 돌린다. Worker `push-be-python`은 운영 구성이 아니다 |
| 데이터 | 로컬 DB는 pgvector Postgres 16, 호스트 포트 5434. 운영 DB는 Neon. 운영 큐는 Redis Streams |
| 이 저장소의 compose | `pgvector/pgvector:pg16`, push-be AI 이미지(`push-be/services/ai/Dockerfile`), Caddy 2. 실행 절을 본다 |

## 이 저장소에서 하는 일

- `push-fe`, `push-be`를 서브모듈로 고정한다.
- `docs/`에 제품 설계 문서를 둔다. `PRD.md`, `feature-map.md`, `feature-spec.md`, `tech-stack.md`는 버전 2.0(작성 2026-10-20, 개정 메모 2026-11-13) 초안이고, `api-spec.md`는 버전 2.3(작성 2026-11-13)이다. 모바일 문서는 개인 에이전트를 봇이라 부르고, 웹과 기업 쪽 문서는 에이전트를 그대로 쓴다. 문서에는 코드에 아직 없는 항목이 `미확정`으로 남아 있다. 동작의 기준은 각 서브모듈 코드다.
- `Makefile`, `compose.yml`, `deploy/Caddyfile`을 둔다.

## 시작하기

```bash
git clone --recurse-submodules https://github.com/push-dot/push-workspace.git
cd push-workspace
git submodule update --init --recursive
```

앱과 API를 띄우는 절차는 서브모듈 README에 있다.

- 웹·모바일: `push-fe/README.md`
- API·워커·배포: `push-be/README.md`

## 실행

필요한 도구는 `make`, Node 22 이상, pnpm 11, uv다. `make db`를 쓰려면 Docker가 있어야 한다. 처음 한 번은 `make setup`으로 서브모듈과 의존성을 받는다.

| 타깃 | 하는 일 |
| --- | --- |
| `make setup` | `git submodule update --init --recursive` 후 `make install`. 핀한 앱 커밋을 받으므로 각 앱 저장소의 develop보다 뒤일 수 있다. `make mobile`은 `expo start`만 실행하므로 개발 빌드가 깔려 있어야 한다 |
| `make install` | push-fe `pnpm install --frozen-lockfile`, push-be `npm ci`, `services/ai`의 `uv sync --locked --extra local --extra test` |
| `make db` | `push-be/infra/docker-compose.yml`의 Postgres(pgvector, 호스트 5434)를 띄운다 |
| `make api` | `push-be/services/ai`에서 uvicorn `app.main:app`을 8080으로 띄운다. 기동할 때 마이그레이션을 적용한다 |
| `make gateway` | `push-be/services/gateway`에서 `npx wrangler dev`(8787) |
| `make core` | `push-be/services/core-api`에서 `npx wrangler dev`(8788, 인스펙터 9230) |
| `make web` | `@push/fo-web` 개발 서버(Vite, 5174) |
| `make mobile` | `@push/fo-mobile`의 `expo start` |
| `make test` | `test-fe`, `test-workers`, `test-ai`를 차례로 실행한다 |
| `make test-fe` | push-fe CI와 같다. `pnpm install --frozen-lockfile`, `turbo run typecheck lint test`, fo-web 빌드 |
| `make test-workers` | push-be 루트에서 `npm ci`, `npm test`, `npm run typecheck` |
| `make test-ai` | push-be CI의 `test-ai`와 같다. `uv sync --locked --no-dev --extra test` 후 `python -m pytest` |
| `make legal-check` | `push-fe/packages/shared/src/legal/md`(웹)와 `md/app`(앱)의 약관·처리방침·동의 파일 여덟 개를 `docs/legal/`과 `docs/legal/app/`에 `diff` |
| `make contract-check` | push-fe api-client의 봇 계약 타입을 push-be가 생성한 `schema.ts`와 한 줄씩 맞춰 컴파일한다. 어긋나면 실패한다. `STRICT=1`이면 서버나 클라이언트에 타입이 아직 없는 줄도 실패한다. `ONLY="bot createBot"`로 줄을 고르고 `BE=`, `FE=`로 다른 체크아웃을 가리킨다 |
| `make contract-check-selftest` | 위 검사를 픽스처 두 벌에 돌려 같은 타입은 통과하고 이름이 바뀐 필드, 서버가 모르는 필드, 서버가 보내지 않을 수 있는 필수 필드, 빠진 서버 타입은 실패하는지 본다 |

`make api`는 `DATABASE_URL` 기본값으로 `make db`의 로컬 Postgres(`localhost:5434`)를 쓴다. 다른 DB를 쓰려면 `make api DATABASE_URL=...`처럼 넘긴다. 포트는 `API_PORT`로 바꾼다. 확인은 `curl localhost:8080/healthz`다. 게이트웨이는 Neon HTTP 드라이버를 쓰기 때문에 로컬 Postgres에는 붙지 않는다.

`compose.yml`은 Postgres(pgvector), api, Caddy(80·443)를 정의한다. api는 `push-be/services/ai`의 Dockerfile로 빌드하고, `push-be/db`를 `/db`에 읽기 전용으로 마운트해서 기동할 때 마이그레이션을 적용한다. 나머지 설정은 `env_file: .env`에서 읽는다. Caddy는 `deploy/Caddyfile`에서 `API_DOMAIN` 호스트를 `api:8080`으로 프록시한다.

## 환경 변수

값은 적지 않는다. 예시 파일은 `.env.example`이다.

| 이름 | 읽는 곳 |
| --- | --- |
| `API_DOMAIN` | `compose.yml`, `deploy/Caddyfile` |
| `POSTGRES_PASSWORD` | `compose.yml`의 Postgres |
| `APP_ENV` | `.env.example`. compose의 api 서비스는 비어 있으면 `production`을 쓴다 |
| `AES_KEY` | `.env.example`에만 있다. compose, Makefile, 스크립트는 이 이름을 읽지 않는다 |

## 테스트

`make test`가 두 서브모듈의 CI 검사를 로컬에서 돌린다. 자세한 내용은 `push-fe`와 `push-be`의 README를 따른다.

`.github/workflows/policy.yml`은 `develop`으로 들어오는 PR을 검사한다. `policy` job은 브랜치가 `feat`, `fix`, `refactor`, `chore`, `docs`, `test` 중 하나 뒤에 케밥 케이스인지, 제목이 `docs(scope): 소문자로 시작` 형태이고 72자를 넘기지 않는지 본다. `legal` job은 `make legal-check`를, `contract-check` job은 `make contract-check-selftest`와 `make contract-check STRICT=1`을 실행한다.

## CI/배포

핀된 백엔드의 배포는 `push-be` GitHub Actions가 맡는다. `develop` push는 스테이징(GitHub environment `staging`, Worker `push-be-staging`·`push-be-core-staging`, VPS `compose.staging.yaml`)에 배포한다. 저장소 변수 `DEPLOY_BRANCH`(비우면 `main`)에 푸시되면 프로덕션으로 VPS 이미지를 올리고, Worker `push-be-core`, Worker `push-be` 순으로 배포한다. 스키마 적용은 수동 워크플로 **Migrate database**다.

이 저장소의 `compose.yml`과 Caddy 파일은 그 파이프라인과 따로 있다. 이 저장소에는 앱·API를 직접 배포하는 워크플로가 없다.

## 브랜치 규칙

기본 브랜치는 `develop`이다. 작업 브랜치는 `develop`에서 만들고, PR은 `develop`으로 연다. `main`에는 릴리스 PR로만 반영한다. 이 저장소 PR은 위의 `policy` 규칙도 따른다.

## 폴더 구조

```
push-workspace/
├─ deploy/Caddyfile      API_DOMAIN → api:8080
├─ docs/                 제품 설계 초안
│  ├─ legal/             약관·처리방침 스냅숏(웹 `*.md`와 앱 `app/*.md`, 본문은 push-fe 원본)
│  ├─ agent-upgrade-plan.md
│  ├─ PRD.md
│  ├─ feature-map.md
│  ├─ feature-spec.md
│  ├─ api-spec.md
│  └─ tech-stack.md
├─ .github/workflows/policy.yml   develop PR의 브랜치·제목 검사, legal-check, contract-check
├─ .gitmodules           push-fe, push-be (develop)
├─ Makefile
├─ compose.yml
└─ .env.example
```

## 관련 저장소

- [push-be](https://github.com/push-dot/push-be) — API
- [push-fe](https://github.com/push-dot/push-fe) — 웹·모바일 모노레포
- [fo-web](https://github.com/push-dot/fo-web) — 웹 앱
- [fo-mobile](https://github.com/push-dot/fo-mobile) — 모바일 앱
- [push-workspace](https://github.com/push-dot/push-workspace) — 이 저장소
- [push-langdig](https://github.com/push-dot/push-langdig) — 랜딩 페이지
