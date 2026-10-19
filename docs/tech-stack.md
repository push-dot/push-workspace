# Push 기술 스택

- 버전: 2.0
- 작성일: 2026-10-20
- 상태: 기존 스택은 각 저장소의 설정 파일 기준이다. 모바일은 2026-10-18 npm 최신판 기준이다.
- 관련 문서: [PRD.md](PRD.md), [api-spec.md](api-spec.md)

## 1. 저장소

세 저장소는 서브모듈로 연결하고 커밋을 고정해서 관리한다.

```
push-workspace           문서, 루트 Makefile, compose.yml, deploy/
├─ push-fe               pnpm 11 + turbo 모노레포
│  ├─ apps/fo-desktop    데스크톱 앱 (Tauri). 현재 루트에 있는 앱을 옮긴다.
│  ├─ apps/fo-web        🆕 WebView 상세 페이지
│  ├─ apps/fo-mobile     🆕 iOS·Android 앱 (Expo)
│  └─ packages/
│     ├─ design-system   vanilla-extract + Mantine (웹·데스크톱)
│     └─ api-client      🆕 fetch 기반 타입·엔드포인트·SSE 파서 (웹·RN 공용)
└─ push-be               서비스 모노레포 (npm workspaces + Python)
   ├─ services/gateway   TS Worker `push-be`
   ├─ services/core-api  TS Worker `push-be-core`
   ├─ services/ai        Python Worker `push-be-python` → VPS 예정
   ├─ packages/contracts FastAPI OpenAPI → TS 타입
   ├─ db/migrations      SQL (0001–0015, 🆕 0016)
   └─ infra              로컬 docker compose
```

## 2. 클라이언트

### 2.1 공통
| 영역 | 선택 |
|---|---|
| 언어 | TypeScript |
| 서버 상태 | TanStack Query 5 |
| 클라이언트 상태 | zustand 5 |
| i18n | i18next (ko, en, ja, vi), Locize(선택) |
| 모니터링 | Sentry |

### 2.2 데스크톱 (fo-desktop)
| 영역 | 선택 |
|---|---|
| 셸 | Tauri 2 (deep-link, opener 플러그인), macOS DMG·Windows NSIS |
| UI | React 19, Vite 6, react-router 7, Mantine 8, vanilla-extract, `@push/design-system` |
| 에디터 | TipTap 3 |
| HTTP | ky (Bearer, 401이면 refresh를 한 번만 시도) |
| 구조 | FSD v2.1 (`app / pages / features / shared`) |
| 테스트 | Vitest, Playwright(웹 e2e), WebdriverIO(Tauri e2e) |

### 2.3 모바일 (fo-mobile) 🆕
| 영역 | 선택 |
|---|---|
| 런타임 | Expo SDK 58, React Native 0.88, dev build (`expo run:ios\|android`) |
| 내비게이션 | Expo Router 58: `expo-router/native-tabs`(NativeTabs), Stack(`headerLargeTitle`, `Stack.SearchBar`, `Stack.Toolbar`) |
| 네이티브 UI | `@expo/ui` 58: `swift-ui`(TextField, Picker, Button + `glassEffect`), `jetpack-compose`(TextField, FilterChip, Bottom Sheet) |
| 글래스 | `expo-glass-effect` |
| WebView | `react-native-webview` 14 (fo-web 상세 전용) |
| 저장 | `expo-secure-store` (토큰) |
| 푸시 알림 | `expo-notifications` (APNs, FCM), 딥링크로 화면 이동 |
| 인증 | `expo-web-browser` (`openAuthSessionAsync`), `expo-crypto` (PKCE) |
| 파일·이미지 | `expo-document-picker`, `expo-image-picker`, `expo-image` |
| 스트리밍 | `expo/fetch` (`ReadableStream`) |
| 플랫폼 분기 | `{name}.ios.tsx` / `{name}.android.tsx` |

### 2.4 fo-web 🆕
Vite, React 19, react-router, TanStack Query, `@push/design-system`을 쓴다. 데스크톱(5173)과 겹치지 않게 포트 5174를 쓰고, 에뮬레이터에서 접속할 수 있게 `host: true`로 띄운다.

## 3. 백엔드

| 영역 | 선택 |
|---|---|
| API 입구 | gateway: TS Worker. 인증 캐시(최대 5초), 속도 제한, Cache API, 라우팅(`ownerOf`) |
| CRUD | core-api: TS 5.9 Worker, wrangler 4, `@neondatabase/serverless`(HTTP) |
| AI | Python 3.13, FastAPI, LangGraph, asyncpg(로컬) / Neon WebSocket(Workers) |
| 채팅 실행 | 로컬·VPS: `chat_jobs` 큐 + `FOR UPDATE SKIP LOCKED` 워커. Workers: Cloudflare Workflow 3단계 |
| 브라우저 | Playwright (SSRF 검증 프록시 경유). Workers에서는 Browser Rendering |
| 문서 | ReportLab(PDF), zip+XML(DOCX), opendataloader-pdf / pypdf(텍스트 추출) |
| RAG | pgvector top-k (evidence 청크) |
| LLM | OpenRouter, OpenAI 호환, BYOK(OpenAI·Claude·Gemini·Grok), 역할별 모델 라우팅 |
| 결제 | Stripe |
| 테스트 | core·gateway: `node --test`, `tsc --noEmit`. ai: pytest |

## 4. 데이터

| 영역 | 선택 |
|---|---|
| DB | PostgreSQL 16 + pgvector, 🆕 `pg_trgm` |
| 운영 DB | Neon (Direct 호스트, `sslmode=require`) |
| 마이그레이션 | `db/migrations/NNNN_*.sql`. 운영은 수동 실행(Actions "Migrate database") |
| 파일 | 로컬: 디스크(`./data/sources`). Workers: `sources.content`. 🆕 이미지는 로컬 디스크를 쓰고 배포할 때 R2로 바꾼다. |

## 5. 인프라·배포

| 영역 | 선택 |
|---|---|
| Edge | Cloudflare Workers: `push-be`(gateway), `push-be-core`, `push-be-python` |
| VPS 🆕 | Hostinger KVM 2 (2 vCPU / 8GB), Dokploy(Docker, Traefik). AI 서비스와 Playwright를 여기서 돌린다. |
| 로컬 | `push-be/infra/docker-compose.yml` (Postgres 5434, ai 8080). gateway와 core는 `wrangler dev`로 띄우고, 🆕 Neon HTTP 프록시가 필요하다. |
| CI/CD | GitHub Actions. push-be는 바뀐 서비스만 테스트하고, main에 push하면 python → core → gateway 순서로 배포한다. push-fe는 typecheck, lint, test, build, e2e를 돌리고 release 워크플로가 DMG·NSIS를 만든다. |
| 브랜치 | `develop` 기준 squash merge. 릴리스는 develop → main PR로 한다. |

## 6. 선택 이유

- **디자인 기준**: Claude Design 세션 "Push 채용 앱 모바일 UI 디자인" 캔버스. 토스·당근·원티드 느낌 + iOS 글래스, 포인트 색 `#5B4CF0`.
- **NativeTabs와 Stack**: 탭 바, 헤더, 검색창, 툴바가 시스템 컴포넌트로 그려진다. iOS 26 글래스를 직접 만들지 않아도 된다.
- **`@expo/ui`**: 입력창과 칩을 SwiftUI와 Compose로 그려서 각 플랫폼 기본 모양을 얻는다.
- **fo-web WebView**: 공고 상세와 프로필 상세를 웹에서도 같은 화면으로 쓴다. 외부 사이트는 WebView로 열지 않는다.
- **v2 CRUD는 core-api(TS)**: 저장소가 이미 AI가 아닌 경로를 TS로 옮기는 중이다.
- **Playwright는 서버에서만**: 휴대폰에서는 브라우저 자동화를 돌릴 수 없다. 사용자가 준 링크 하나만 읽고 그 사용자 데이터로만 쓴다.
- **AI만 VPS로**: Workers Python은 CPU 10ms 제한, Browser Rendering 하루 10분 한도, 스트리밍 제약이 있다. 읽기와 CRUD는 Workers에 그대로 둔다.
