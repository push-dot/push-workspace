<h1 align="center">Push</h1>

<p align="center">
  <strong>공고와 경력 근거를 한 계정에 두고, 서류와 지원 활동을 잇는 커리어 작업공간</strong>
</p>

---

**Push**는 개인용 모바일 앱, 개인·기업 웹, 그리고 그 뒤의 API로 이루어진다. 모바일에서 공고를 보고 에이전트(AI 채팅)로 대화를 이어 가고, 웹에서는 같은 계정의 공고·허브·소셜과 기업 채용 업무를 다룬다. 이력서 워크플로는 서버의 단계 게이트를 거치고, 근거 검색은 pgvector로 한다.

이 저장소(`push-workspace`)는 제품 문서와 서브모듈 핀을 둔다. 앱 코드는 [push-fe](https://github.com/push-dot/push-fe), 웹·모바일 앱 저장소는 [fo-web](https://github.com/push-dot/fo-web)·[fo-mobile](https://github.com/push-dot/fo-mobile), API 코드는 [push-be](https://github.com/push-dot/push-be)에 있다. `.gitmodules`의 브랜치는 `develop`이다.

이 저장소가 핀한 서브모듈 커밋은 push-be `766a635`, push-fe `9911f12`이다. 이미 받은 클론은 `git submodule update --init --recursive`로 중첩 서브모듈까지 받는다. 동작의 기준은 각 서브모듈 develop이다.

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
| push-workspace | 서브모듈 핀, 제품 문서. `Makefile`과 `compose.yml`은 루트에 uvicorn과 Dockerfile이 있던 배치를 가정한다. |

## 기술 스택

아래는 이 저장소가 핀한 서브모듈 기준이다.

| 영역 | 선택 |
| --- | --- |
| 모바일 | Expo SDK 58, React Native 0.88, Expo Router(Native Tabs, Stack. 대화 목록은 탭 위 스택), React 19.3, TanStack Query 5, Zustand 5, `@expo/ui`, Noto Sans KR (`apps/fo-mobile/src/theme/fonts.ts`의 `NotoSansKR-Regular`·`Medium`·`SemiBold`·`Bold`·`ExtraBold`. 웹 토큰은 `packages/design-system/src/tokens.ts`의 `"Noto Sans KR", "Noto Sans"`) |
| 웹 | Vite 6, React 19.1, React Router 7, TanStack Query 5. 개발 서버 포트 5174 |
| 공통 클라이언트 | TypeScript, pnpm 11, Turborepo 2, ky(`@push/api-client`), es-hangul(`@push/shared`) |
| 엣지 | Cloudflare Workers. gateway Worker `push-be`, core Worker `push-be-core`. npm 패키지명은 각각 `push-be-front`, `push-be-core`. Wrangler 4, TypeScript 7, `@neondatabase/serverless` |
| AI | Python 3.12 이상. 이미지와 CI 상한은 3.15. FastAPI, LangGraph, uvicorn. Hostinger VPS의 Docker·Traefik 위에서 `ai-worker`, `ingest-worker`, `notify-worker`, `dispatcher`와 Redis Streams를 돌린다. Worker `push-be-python`은 운영 구성이 아니다 |
| 데이터 | 로컬 DB는 pgvector Postgres 16, 호스트 포트 5434. 운영 DB는 Neon. 운영 큐는 Redis Streams |
| 이 저장소의 compose | `postgres:17-alpine`과 Caddy 2. 실행 절을 본다 |

## 이 저장소에서 하는 일

- `push-fe`, `push-be`를 서브모듈로 고정한다.
- `docs/`에 제품 설계 문서를 둔다. `PRD.md`, `feature-map.md`, `feature-spec.md`, `tech-stack.md`는 버전 2.0(작성 2026-10-20, 개정 메모 2026-11-11) 초안이고, `api-spec.md`는 버전 2.2(작성 2026-11-11)이다. 문서에는 코드에 아직 없는 항목이 `미확정`으로 남아 있다. 동작의 기준은 각 서브모듈 코드다.
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

서브모듈을 받은 뒤 맞추는 명령은 각 README의 실행 절이다. 이 저장소 `Makefile`이 호출하는 명령은 다음과 같다.

| 타깃 | 호출 |
| --- | --- |
| `make api` | `push-be`에서 `uvicorn app.main:app --host 0.0.0.0 --port 8080` |
| `make web` | `npm --prefix push-fe run dev` |
| `make test` | `push-be`에서 `python -m pytest`, 이어서 push-fe의 `test`, `lint`, `typecheck`, `build` |
| `make legal-check` | `push-fe/packages/shared/src/legal/md`의 약관·처리방침 파일을 `docs/legal/`과 `diff` |

웹과 모바일은 push-fe에서 패키지 필터로 띄운다.

```bash
pnpm --prefix push-fe --filter @push/fo-web dev
pnpm --prefix push-fe --filter @push/fo-mobile start
```

핀된 `push-be`의 FastAPI 엔트리는 `services/ai/src/app/main.py`이다. 로컬 Postgres와 uvicorn은 `push-be/infra/docker-compose.yml`이 띄운다. 그 트리에는 루트 Dockerfile과 `app` 패키지가 없다. `make api`와 `compose.yml`의 `build: ./push-be`는 그 경로를 가리킨다. push-fe 루트 `package.json`에는 `dev` 스크립트가 없어서 `make web`도 현재 트리와 맞지 않는다.

`compose.yml`은 Postgres 17, `env_file: .env`를 읽는 api 서비스, Caddy(80·443)를 정의한다. Caddy는 `deploy/Caddyfile`에서 `API_DOMAIN` 호스트를 `api:8080`으로 프록시한다.

## 환경 변수

값은 적지 않는다. 예시 파일은 `.env.example`이다.

| 이름 | 읽는 곳 |
| --- | --- |
| `API_DOMAIN` | `compose.yml`, `deploy/Caddyfile` |
| `POSTGRES_PASSWORD` | `compose.yml`의 Postgres |
| `APP_ENV` | `.env.example`. compose의 api 서비스 environment에도 있다 |
| `AES_KEY` | `.env.example`에만 있다. compose, Makefile, 스크립트는 이 이름을 읽지 않는다 |

compose의 api 서비스는 `LISTEN_ADDR`를 환경에 넣는다. 이 이름은 `.env.example`에 없다.

## 테스트

서브모듈 테스트는 `push-fe`와 `push-be`의 README를 따른다.

`.github/workflows/policy.yml`은 `develop`으로 들어오는 PR을 검사한다. `policy` job은 브랜치가 `feat`, `fix`, `refactor`, `chore`, `docs`, `test` 중 하나 뒤에 케밥 케이스인지, 제목이 `docs(scope): 소문자로 시작` 형태이고 72자를 넘기지 않는지 본다. `legal` job은 `make legal-check`를 실행한다.

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
│  ├─ legal/             약관·처리방침 스냅숏(본문은 push-fe 원본)
│  ├─ agent-upgrade-plan.md
│  ├─ PRD.md
│  ├─ feature-map.md
│  ├─ feature-spec.md
│  ├─ api-spec.md
│  └─ tech-stack.md
├─ .github/workflows/policy.yml   develop PR의 브랜치·제목 검사와 legal-check
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
