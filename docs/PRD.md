# Push PRD (Product Requirements Document)

- 버전: 2.0
- 작성일: 2026-10-20
- 상태: 초안
- 이전 버전: 1.0 (2026-09-16, `docs/prd.md`, 커밋 `72fe539`에서 삭제)
- 관련 문서: [feature-map.md](feature-map.md), [feature-spec.md](feature-spec.md), [api-spec.md](api-spec.md), [tech-stack.md](tech-stack.md)

## 1. 개요

Push는 근거 수집부터 문서 작성, 지원, 면접, 오퍼까지 구직 과정 전체를 한 작업공간에서 관리한다. 흐름은 `탐색 → 역량 보완 → 문서 생성 → 지원 → 면접 → 오퍼`다.

v2는 기존 데스크톱 앱(macOS·Windows)을 그대로 두고 **iOS·Android 모바일 앱을 추가**한다. 두 클라이언트는 같은 계정과 같은 백엔드 API를 쓴다. 대화, 지원, 이력서 파일, 공고는 양쪽에서 함께 보인다.

| 클라이언트 | 역할 |
|---|---|
| 데스크톱 (Tauri) | 깊이 있는 작업: 문서 편집·확정·출력, 역량 보완 프로젝트(CLI), 캘린더, 결제·설정. Career Vault와 면접 준비는 추후 |
| 모바일 (Expo) | 이동 중 사용과 네트워크: 공고 탐색·저장·지원 기록, 허브(이력서 프로필), 소셜, AI 이력서 채팅, 내 활동 |
| fo-web | 모바일 앱 WebView 안에 띄우는 상세 페이지: 채용공고 상세, 허브 프로필 상세 |

## 2. 배경과 문제 정의

- 구직 활동이 이력서 도구, 스프레드시트, 메일, 캘린더, 메모 앱에 흩어져 있다.
- AI 문서 생성 도구가 근거 없는 경력이나 수치를 만들어 신뢰를 잃는다.
- 지원 진행 상황과 후속 행동(팔로업 메일, 면접 준비)을 함께 추적하는 도구가 없다.
- (v2) 공고는 대부분 휴대폰에서 발견하지만 Push는 데스크톱에서만 쓸 수 있었다. 같은 직군 사람들과 커리어 정보를 나눌 곳도 없었다.

## 3. 목표

- Career Vault에 모은 근거가 공고 분석, 문서, 프로젝트, 면접 답변까지 이어서 추적된다. (Career Vault와 면접은 추후)
- 근거 없는 경험, 수치, 기술을 AI가 생성하지 못한다.
- 사용자가 승인하지 않은 지원 제출은 일어나지 않는다.
- (v2) 모바일에서 공고를 찾아 저장하고, AI 채팅으로 이력서를 만들고, 지원을 기록하는 일을 끝까지 할 수 있다.
- (v2) 모바일 앱은 토스·당근·원티드 느낌의 Push 브랜드 UI에 iOS 26 글래스 컴포넌트(원형 버튼, 탭 바, 검색창, 입력창, 시트, 메뉴)를 최대한 쓴다. Android는 같은 브랜드 UI를 불투명하게 그린다.
- (v2) AI 이력서 채팅은 Claude Code처럼 에이전트가 일하는 과정(상태 줄, 도구·결과 줄, 할 일, diff, 승인 패널)을 그대로 보여준다.

## 4. 비목표

- 기업 채용 담당자용 ATS 관리 기능. 단, v2에서 기업 회원의 공고 등록과 허브 제안은 지원한다.
- 내장 터미널과 자체 PTY
- 법적 허가를 확인하지 않은 채용 사이트로 자동 제출
- (v2) 외부 채용 사이트를 크롤링해 공고 카탈로그를 만드는 일
- (v2) 사용자 화면의 WebView로 외부 사이트를 여는 일
- (v2, 이번 범위 밖)
  - 기업 공고 작성 UI
  - 오프라인 캐시
  - 비로그인 열람
  - 데스크톱 API client 리팩터링
  - EAS·스토어 빌드
  - 모바일 문서 편집기
  - 모바일 역량 보완 프로젝트(CLI)
  - 댓글 좋아요

## 5. 대상 사용자

| 사용자 | 하는 일 |
|---|---|
| 개인 구직자 | 근거 수집, 공고 분석, 문서 생성, 지원, 면접, 오퍼 관리 |
| 재직자 (v2) | 허브에 프로필을 올리고 커리어 상태를 표시한다. 소셜에서 소통한다. |
| 기업 회원 (v2, `is_employer`) | Push에 공고를 올리고 허브 프로필에 제안을 보낸다. |

UI는 한국어와 영어를 지원하고, 번역 리소스에는 ja와 vi도 있다.

## 6. 플랫폼

자세한 내용은 [tech-stack.md](tech-stack.md)에 있다.

| 영역 | 스택 |
|---|---|
| 데스크톱 | Tauri 2, React 19, Vite, TipTap, Mantine, vanilla-extract |
| 모바일 | Expo SDK 58, React Native, Expo Router(NativeTabs, Stack), `@expo/ui`(SwiftUI·Compose) |
| 웹(WebView) | Vite, React, `@push/design-system` |
| API | Cloudflare Workers: gateway, core-api(TS) |
| AI | Python FastAPI, LangGraph, Playwright. Workers에서 VPS로 옮길 예정이다. |
| DB | PostgreSQL 16 + pgvector (Neon) |
| 인증 | Google·GitHub OAuth, PKCE. `push://auth/callback`으로 돌아온다. |
| AI 모델 | 관리형(OpenAI 호환, OpenRouter)과 BYOK(OpenAI·Claude·Gemini·Grok). BYOK 키는 AES-GCM으로 암호화한다. |
| 결제 | Stripe 월 구독(FREE·PRO·ULTRA)과 크레딧 |

## 7. 기능 요구사항

`[공통]`은 데스크톱과 모바일 모두, `[D]`는 데스크톱만, `[M]`은 모바일만 해당한다. 화면 구조는 [feature-map.md](feature-map.md)에, 규칙은 [feature-spec.md](feature-spec.md)에 있다.

### 7.1 Career Vault [D] — 추후
- 기존 이력서, GitHub, 경력, 학력, 기술, 성과 수치, 프로젝트 증거를 한 번만 수집한다.
- AI가 만든 내용은 모두 원본 근거와 연결한다. 근거 없는 경험은 생성하지 못하게 막는다.
- 이력서 파일 업로드는 `[공통]`이다. 모바일에서는 마이 > 이력서에서 올린다.

### 7.2 공고 [공통]
공고는 출처에 따라 둘로 나뉜다.

| 구분 | 출처 | 보관 | 노출 범위 |
|---|---|---|---|
| A. 내 공고 | 사용자가 준 링크 하나를 서버가 읽는다. 텍스트를 붙여넣거나 데스크톱 DOM으로 가져와도 된다. | 그 사용자의 `jobs` | 본인만 |
| B. 기업 공고 (v2) | 기업 회원이 Push에 직접 올린다. | `job_postings` | 모든 사용자 |

- A를 읽을 때 지킬 것
  - 로그인, 유료 공고, CAPTCHA를 우회하지 않는다. 막히면 텍스트 붙여넣기로 받는다.
  - 사이트별로 속도를 제한한다.
  - 출처와 원문 링크를 표시한다.
- 요구 기술, 역할, 우대사항, 키워드, 위험 요소와 후보자 사이의 차이를 분석한다 `[D]`.
- 모바일 홈 탭은 A와 B를 함께 검색하고 필터한다 `[M]`.

### 7.3 지원 관리 [공통]
- 상태 기계는 `DISCOVERED → PREPARING → READY → APPLIED → SCREENING → INTERVIEW → OFFER → ACCEPTED | REJECTED | WITHDRAWN`이다.
- `APPLIED`는 제출(submission)을 거쳐야만 된다. 최종 제출은 지원 건마다 사용자가 승인한다.
- 지원 사이트 어댑터(Wanted, Jumpit, JobKorea)는 기본으로 꺼져 있고, 수동 체크리스트를 제공한다.
- 모바일에서는 기업 공고에 "지원하기"를 눌러 지원을 기록하고, 마이 > 내 활동 > 지원활동에서 본다.

### 7.4 문서 작업실 [D]
- 이력서와 포트폴리오는 PDF로, 자기소개서는 DOCX로 출력한다. 템플릿은 심플, 모던, 크리에이티브, ATS 네 가지다(현재 코드는 CLASSIC, MODERN, COMPACT라서 바꿔야 한다). 프로필 사진은 템플릿과 상관없이 모든 템플릿에 넣을 수 있다.
- TipTap 선택 영역에서 AI 수정을 한다: 다시 쓰기, 줄이기, 수치 강조, 톤 변경, 공고 맞춤.
- 문서마다 공고 적합도, 근거 충실도, 가독성, ATS 점수를 보여준다. 근거가 없는 주장이 있으면 확정하지 못한다.

### 7.5 AI 채팅 [공통]
- 단계 게이트 워크플로(Phase 0–6)로 이력서를 만든다. 게이트마다 사용자 승인을 받는다.
- 토큰은 SSE로 스트리밍한다. 연결이 끊겨도 이어서 받을 수 있다.
- 모바일 "AI 이력서" 탭은 같은 대화 목록을 쓴다. 화면에는 페이즈 이름을 보여주지 않고 Claude Code 방식으로 진행을 보여준다([feature-spec.md](feature-spec.md) 15장).
- 공고 상세의 "AI로 맞추기", 홈의 적합도 카드, 마이 이력서 빈 상태의 "AI로 만들기"에서 바로 들어온다. `@`로 마이 이력서와 북마크 공고를 언급할 수 있다.
- 공고별 적합도(10점, 5개 항목)를 홈 공고 목록과 공고 상세에 표시한다.

### 7.6 역량 보완 프로젝트 [D]
- 부족한 역량을 기준으로 프로젝트 블루프린트를 제안한다.
- 외부 Terminal에서 코딩 CLI(`CODEX | CLAUDE_CODE | GROK_BUILD`)를 승인을 받은 뒤 실행한다.
- 커밋, 테스트, 지표를 검증한 뒤에만 Career Vault에 반영한다.

### 7.7 면접·캘린더·연동 [D]
- 면접 준비(예상 질문, STAR 답변, 회사 조사, 회고)는 **추후** 진행한다.
- 내부 캘린더와 Google Calendar를 연동한다. Gmail 동기화는 베타 플래그 뒤에 둔다.

### 7.8 허브: 이력서 프로필 (v2) [M]
- 프로필 항목: 헤드라인, 직군, 연차, 커리어 상태(만족 / 이직·구직중 / 프로필 피드백), 소개, 경력 타임라인, 기술 스택, 팔로워 수, 제안 받기 여부, 대표 이력서
- 검색, 직군 토글 칩(개발·디자인·기획·마케팅·데이터·영업), 재직 기간(0–2·3–5·6–9·10+년)·커리어 상태 필터를 제공한다.
- 탐색 필터는 두 가지다: 추천(내 직군과 같음), 제안(내가 제안을 보낸 프로필, "보낸 제안 N").
- 팔로우와 제안하기. 제안은 프로필마다 한 번만 보낼 수 있고 메시지는 500자까지다.
- 받은 제안은 상대의 **알림함**(푸시 포함)과 **마이 헤더 제안함**으로 전달된다.

### 7.9 소셜 (v2) [M]
- 카테고리: 전체, 직장 생활, 개발, 일상, 커리어, 소통, 커피챗, 마케팅·광고
- 게시물은 무한 스크롤로 보여준다. 이미지는 최대 4장이고 댓글과 답글을 달 수 있다.

### 7.10 마이 (v2) [M]
- 상단 탭: 프로필 | 이력서(외부 파일 등록) | 내 활동(지원활동·북마크·팔로우·게시글)
- 프로필은 허브 프로필과 같은 화면이다("허브에 이렇게 보여요 · 팔로워 N"). 전체 편집 버튼은 없고 섹션(기본 정보·소개·경력·기술 스택)마다 편집 버튼이 있다.
- 지원활동 배지: 지원함 · 서류 · 면접 · 합격 · 불합격

- 마이 헤더 오른쪽 위: 제안함(안 읽은 수 배지)과 설정(톱니바퀴) 글래스 버튼. 세 탭 모두 같다.
- 제안함: 받은 제안 / 보낸 제안, 상태(새 제안·수락함·거절함), 상세에서 거절 또는 수락하고 답장하기. 제안에 공고를 함께 보낼 수 있다.
- 설정: 계정, 알림(마감 임박·제안·댓글과 답글·AI 작업 완료), 허브 공개(프로필·커리어 상태·연락처), AI 이력서(기본 말투·대화 기록 보관·내 자료 읽기 허용), 고객센터·약관·로그아웃

### 7.11 푸시 알림 (v2) [M]
- Push 앱의 푸시 알림을 전체 구현한다. iOS(APNs)와 Android(FCM)를 `expo-notifications`로 받는다.
- 알림 종류는 설정의 스위치 4개와 같다: 마감 임박 공고(북마크 공고 마감 3일 전), 제안 받음, 댓글과 답글, AI 작업 완료(앱을 닫아도 알림).
- 같은 알림이 앱 안 **알림함**(홈 헤더 글래스 버튼)에도 쌓인다.
- 알림을 누르면 해당 화면으로 바로 간다(공고 상세, 제안 상세, 게시물 상세, AI 이력서 대화).
- 설정에서 종류별로 끌 수 있다. 처음 실행 시 OS 알림 권한을 요청한다.

### 7.12 승인 체계 [공통]
- 승인 종류: `EVIDENCE_USE`, `DOCUMENT_FINALIZE`, `APPLICATION_SUBMIT`, `CLI_EXECUTE`
- 승인은 기본 24시간 동안 유효하고, 대상 revision이 바뀌면 무효가 된다(`APPROVAL_STALE`).

### 7.13 결제·AI 키 [D]
- Stripe Checkout과 Portal로 결제하고, 크레딧 원장을 둔다.
- BYOK 키를 등록하고 사용량을 조회한다.

## 8. UI 계약

### 8.1 데스크톱 (기존 유지)
- 좌측 사이드바는 Aside의 외형을 따르고, 섹션은 `기능 / 채팅 / 프로젝트`다.
- 기능 항목: 지원 현황, 내 서류, 캘린더, 면접 준비(추후)
- 오른쪽 컨텍스트 패널은 없다. 채팅 캔버스가 전체 폭을 쓴다.
- OS 기본 창 장식을 쓰고, 라이트·다크·시스템 테마와 한국어·영어를 지원한다.

### 8.2 모바일 (v2)
- 탭 5개: 홈 · 허브 · 소셜 · AI 이력서 · 마이
- 디자인 기준은 Claude Design 세션 "Push 채용 앱 모바일 UI 디자인"의 캔버스다.
- 스타일: 토스·당근·원티드 느낌(크고 굵은 한글 제목, 넉넉한 여백, 둥근 회색 카드, 꽉 찬 캡슐 CTA). 포인트 색은 바이올렛 블루 `#5B4CF0` 하나.
- iOS
  - 탭 바는 `NativeTabs`로 그린다(떠 있는 글래스 캡슐, 스크롤하면 작은 글래스 원).
  - 헤더는 Expo Router Stack으로 만든다: `Stack.SearchBar`, `Stack.Toolbar`(글래스 원형 버튼).
  - 입력창, 시트, 메뉴, 세그먼트, 보조 버튼, 칩은 글래스다. 입력창은 SwiftUI `TextField`에 `glassEffect`를 적용한다.
- Android: 같은 브랜드 UI를 불투명하게. Material 3 Navigation Bar, Top App Bar, SearchBar, FilterChip, Bottom Sheet
- 화면은 `{name}.ios.tsx`와 `{name}.android.tsx`로 나눠 만든다. 데이터 로직은 함께 쓴다.
- iOS에서 "투명도 줄이기"가 켜져 있으면 글래스를 끈다. 다크 모드와 Dynamic Type을 지원한다.

## 9. 데이터 모델 (주요 타입)

- 기존: `CareerEvidence`, `Source`, `Job`, `Application`, `Submission`, `Document`, `DocumentVersion`, `GapAnalysis`, `ProjectBlueprint`, `ProjectRun`, `ProjectEvidence`, `Interview`, `CalendarEvent`, `Approval`, `Operation`, `Conversation`, `Message`, `AiUsage`
- v2 신규: `JobPosting`(기업 공고), `Profile`, `Bookmark`, `Follow`, `Offer`(허브 제안), `Post`, `PostComment`

## 10. API 영역

API 영역은 `/auth`, `/conversations`, `/approvals`, `/operations`, `/jobs`, `/applications`, `/documents`, `/career-evidence`, `/sources`, `/projects`, `/interviews`, `/calendar`, `/integrations`, `/ai`, `/billing`, `/experiments`이고, v2에서 `/postings`, `/profiles`, `/users`, `/me`, `/posts`, `/uploads`를 추가한다.

- API 계약은 [api-spec.md](api-spec.md)에 먼저 쓰고, FE와 BE는 그 계약에 맞춰 함께 개발한다.
- 오퍼(`/offers`)는 v1 계획에 있었지만 아직 만들지 않았다. 지금은 지원 단계 `OFFER`로만 기록한다.

## 11. 비기능 요구사항

- 보안: 키, 이력서, 메일 내용, 토큰을 로그나 분석 이벤트에 남기지 않는다. 다른 사용자의 리소스는 404로 숨긴다.
- 서버가 외부 원문을 읽을 때는 SSRF 검증 프록시를 거친다. 원문은 신뢰하지 않는 데이터로 다루고 AI 도구 실행 지시로 쓰지 않는다.
- 성능
  - 모바일 홈 검색 p95 500ms 이하. 외부 호출 없이 DB만 조회한다.
  - 채팅 첫 토큰 p95 3초 이하
- 가용성: 클라이언트가 끊겨도 채팅 작업은 서버 큐에서 계속 진행되고, 다시 연결하면 이어서 받는다.
- 접근성
  - 데스크톱: 키보드 탐색, VoiceOver 레이블, 창을 줄였을 때의 레이아웃, 다크 모드
  - 모바일: VoiceOver·TalkBack 레이블, Dynamic Type, "투명도 줄이기"

## 12. 성공 지표와 완료 조건

- 기존(v1)
  - 근거가 추적되는지, 공고 사이의 데이터가 분리되는지 확인한다.
  - 근거 없는 주장은 확정하지 못해야 한다.
  - PDF·DOCX 출력이 정상인지 검사한다.
  - OAuth와 토큰 만료, Stripe 웹훅 중복을 처리하는지 확인한다.
  - 승인하지 않은 제출이 없는지 E2E로 확인한다.
- v2
  - 링크로 추가한 공고를 읽는 데 성공한 비율이 80% 이상이다. 실패한 건은 텍스트 붙여넣기로 받는다.
  - 모바일에서 공고 저장 → AI 채팅 이력서 → 지원 기록까지 E2E 흐름을 끝낸다.
  - iOS 26 시뮬레이터와 Android 에뮬레이터에서 [feature-spec.md](feature-spec.md)의 화면별 규칙을 확인한다.
  - 데스크톱 회귀가 없다: 기존 e2e, Tauri 빌드, Windows 빌드
- 베타: 20명 중 80% 이상이 공고 등록부터 문서 생성, 지원 추적까지 끝낸다.

## 13. 마일스톤과 구현 절차 (v2)

1·3·4단계(프런트엔드)는 확정됐다. 2단계(백엔드)는 미확정 설계안이다.

### 13.0 사전 안전 조치

- push-be와 push-fe 모두 `feat/recruiting` 브랜치에서만 작업하고 develop에는 병합하지 않는다. push-be는 main에 push하면 CD가 배포하고, 마이그레이션은 수동으로 적용한다.
- 클라우드 설정은 건드리지 않는다: wrangler 배포, Neon, root `compose.yml`, `deploy/`. 검증은 로컬 서버와 로컬 DB에서만 한다.
- 시드 데이터는 마이그레이션에 넣지 않고 `services/ai/scripts/seed_local.py`로 만든다. 이 스크립트는 `APP_ENV=development`가 아니면 실행을 거부한다.
- 1단계를 시작하기 직전에 두 서브모듈의 `git status`를 다시 확인한다.
- 알려진 한계를 일부러 남길 때는 코드에 `shortcut: <한계>, <언제 바꿀지>` 형식의 주석을 단다.

### 13.1 1단계: push-fe 모노레포 전환 (데스크톱 유지) — 확정

- `git mv`로 다음을 `apps/fo-desktop/`에 옮긴다: `src src-tauri e2e e2e-tauri scripts index.html vite.config.ts tsconfig*.json eslint.config.js playwright.config.ts wdio.conf.ts app-icon.png`
  - 경로가 모두 상대 경로라 `tauri.conf.json`은 그대로 둔다.
- `apps/fo-desktop/package.json`(`@push/fo-desktop`)을 만든다. 지금 root에 있는 의존성, 앱 스크립트, `"tauri": "tauri"`를 옮긴다.
- root `package.json`에는 `turbo`, `prettier`, `typescript`만 남긴다. 스크립트는 `turbo run … --filter=@push/fo-desktop`으로 넘긴다.
- `pnpm-workspace.yaml`에 `apps/*`를 추가한다.
- `turbo.json`에서 `//#*` 태스크를 지우고 `start`, `ios`, `android`(persistent)를 추가한다.
- `.github/workflows/ci.yml`과 `release.yml`을 고친다.
  - working-directory를 `apps/fo-desktop`으로 바꾼다.
  - 산출물 경로를 `apps/fo-desktop/src-tauri/target/release/bundle/...`로 바꾼다.
- workspace `Makefile`은 `desktop:` 한 줄만 고친다.
- `packages/design-system`에 `"./palette"` export를 추가한다. RN에서는 브랜드 색상만 가져다 쓴다.

**검증**
- `pnpm install && pnpm turbo run typecheck lint test`
- `pnpm run build`
- Playwright e2e
- `pnpm tauri build --debug --bundles app`
- Windows NSIS 빌드는 CI에서 확인한다.

### 13.2 2단계: push-be — 미확정 설계안

API와 테이블 초안은 [api-spec.md](api-spec.md) 4–5장에 있다. 아래 항목은 바뀔 수 있다.

- 마이그레이션 `db/migrations/0016_recruiting.sql`
  - 테이블: `job_postings`, `users.is_employer`, `profiles`, `bookmarks`, `follows`, `offers`, `posts`, `post_comments`
  - `pg_trgm` 인덱스
- 코드 위치: `services/core-api/src/routes/recruiting.ts`. 기존 `routes/jobs.ts` 패턴을 따른다.
  - 등록은 `handler.ts`의 dispatch와 gateway `owner.ts`의 `isCore`에 경로를 추가하는 것으로 끝낸다.
- 이미지 업로드: Worker에는 디스크가 없으므로 ai 서비스(FastAPI)가 맡는다.
  - 로컬은 `storage_dir/images/`에 저장한다. 코드에 `shortcut: local disk, swap to R2 at deploy` 주석을 단다.
- 다시 쓰는 기존 API: 지원활동은 `GET /applications`, 이력서 업로드는 `POST /sources`
- 테스트: `services/core-api/test/recruiting.test.ts`. `deps.query` fake를 쓰고 다음을 확인한다.
  - 필터가 SQL 파라미터로 맞게 바뀐다.
  - A와 B를 합친 목록이 나온다.
  - 북마크를 두 번 해도 결과가 같다.
  - 기업 회원이 아니면 `POST /postings`가 403이다.
  - 자기 자신 팔로우는 거부된다.
  - 잘못된 카테고리는 422다.

**검증**
- 단위: push-be 루트에서 `npm test`, `npm run typecheck`
- 로컬 E2E
  - `docker compose -f infra/docker-compose.yml up -d`로 Postgres(5434)와 ai(8080)를 띄운다.
  - core와 gateway는 Neon HTTP 프록시를 붙인 뒤 `wrangler dev`로 띄운다.
- 시드를 넣은 뒤 curl로 호출한다. POST에는 `Idempotency-Key`를 붙인다.

### 13.3 3단계: `packages/api-client` + fo-web — 확정

- `@push/api-client`: fetch 기반이라 웹과 RN에서 함께 쓴다.
  - `createClient({baseUrl, getToken, fetch})`: Bearer와 Idempotency-Key를 자동으로 붙인다.
  - 타입, 엔드포인트 함수, 카테고리 한국어 라벨
  - `sse.ts`의 `parseFrames`: 데스크톱 채팅 코드에서 옮겨 오고 vitest를 붙인다.
- `apps/fo-web`: Vite + React + react-router + React Query + design-system
  - 포트 5174, `host: true`
  - 라우트: `/postings/:id`, `/profiles/:id`. 읽기 전용이다.
  - `bridge.ts`
    - 토큰과 API 주소는 `window.__PUSH__`에서 읽는다.
    - 웹 → 네이티브: `postMessage`로 `title`, `open`, `error`를 보낸다.
    - 네이티브 → 웹: `push:token` 이벤트로 새 토큰을 받는다.
  - 모바일 CSS: safe-area, 시스템 폰트, 다크 모드

**검증**
- turbo typecheck, lint, test, build
- 브라우저에서 `localhost:5174/postings/<seedId>`를 열어 본다.
- 1단계 데스크톱 검증을 다시 실행한다.

### 13.4 4단계: fo-mobile (Expo SDK 58) — 확정

- `create-expo-app`(sdk-58)으로 만든다.
- 패키지: `expo-router expo-glass-effect @expo/ui react-native-webview expo-secure-store expo-document-picker expo-web-browser expo-crypto @tanstack/react-query`, `@push/api-client`
  - 소셜용으로 `expo-image-picker`, `expo-image`도 넣는다.
- `app.json`에 `scheme: "push"`를 넣는다. 백엔드에 이미 있는 `push://auth/callback`을 그대로 쓴다.
- dev build(`expo run:ios|android`)로 실행한다.

#### 라우트 파일 (`src/app/`)
Route 파일은 얇게 두고, 플랫폼별 분리는 `src/screens/`에서 한다.
- `_layout.tsx`: Root Stack, `sign-in`(modal), 세션 게이트
- `(tabs)/_layout.tsx`: `NativeTabs`, `minimizeBehavior="onScrollDown"`, 탭 5개(SF Symbol과 Material 아이콘)
- `(tabs)/(home,hub,social,chat,my)/_layout.tsx`: 탭끼리 공유하는 Stack. 각 탭 첫 화면은 large title을 쓴다.
- `postings/[id].tsx`, `profiles/[id].tsx`: 여러 탭이 함께 쓰는 WebView 화면
  - `injectedJavaScriptBeforeContentLoaded`로 토큰을 주입한다.
  - `onMessage`로 받은 `title`, `open`을 처리한다.
  - `Stack.Toolbar` 오른쪽: 북마크(프로필 화면은 팔로우), 공유
  - 아래쪽: 지원하기
- `(social)/compose.tsx`, `(my)/edit-profile/[section].tsx`(섹션별 편집): formSheet

#### 화면 (`src/screens/*.ios.tsx` / `*.android.tsx`)
- **홈**
  - 검색은 `Stack.SearchBar`다. iOS에서는 글래스 검색창으로 보인다.
  - 필터는 화면 위 칩 줄이다. 칩을 누르면 iOS는 글래스 체크마크 풀다운 메뉴, Android는 Compose `FilterChip`과 bottom sheet가 열린다(Claude Design 기준).
  - 적합도 카드, "새로 올라온 공고", "이번 주 많이 본 공고" 섹션, 공고별 적합도 배지
- **허브**
  - 검색, 직군 토글 칩(iOS는 SwiftUI glass 버튼, Android는 `FilterChip`)
  - 재직 기간, 커리어 상태, 탐색 필터는 메뉴나 시트에 넣는다.
  - 프로필 상세(WebView) 툴바에 "제안하기"를 둔다. 누르면 메시지 입력 formSheet가 열리고 `POST /profiles/{id}/offer`를 호출한다.
- **소셜**
  - 카테고리 칩을 둔다.
  - 목록은 `useInfiniteQuery`와 `FlatList onEndReached`로 무한 스크롤한다.
  - 툴바의 작성 버튼을 누르면 compose로 이동한다.
  - compose
    - 입력창은 iOS에서 SwiftUI `TextField`, Android에서 Compose `TextField`를 쓴다.
    - 이미지는 `expo-image-picker`로 고르고 업로드한다.
  - `(social)/posts/[id].tsx`: RN 상세 화면
    - 본문, 이미지(`expo-image`), 댓글 목록을 보여준다.
    - 댓글 입력창은 하단에 고정한 glass TextField다. 채팅 composer를 재사용한다.
- **AI 이력서** (탭 이름. 라우트 그룹은 `(chat)`)
  - Claude Code 방식 진행 표시와 모션 스펙은 [feature-spec.md](feature-spec.md) 15장을 따른다.
  - 기존 `conversations` API를 쓴다. `expo/fetch`로 스트림을 읽고 `parseFrames`로 해석한다.
  - 플랫폼별로 나누는 건 입력창뿐이다: `chat-composer.ios`(glassEffect TextField), `chat-composer.android`
- **마이**
  - 세그먼트: iOS는 SwiftUI `Picker` segmented, Android는 segmented button
  - 프로필
  - 이력서: `expo-document-picker`로 고른 파일을 `POST /sources`로 올리고 `PUT /me/profile`을 호출한다.
  - 내 활동: 지원활동, 북마크, 팔로우

#### 공통 코드
- `src/lib/session.ts`: zustand와 secure-store를 쓴다. 토큰 refresh는 single-flight로 처리한다.
- `src/lib/api.ts`
- iOS "투명도 줄이기"가 켜져 있으면 glass를 끈다.
- 코딩을 시작하기 전에 `@expo/ui@58`의 `.d.ts`에서 Android 컴포넌트 이름과 SwiftUI glass button 모디파이어 이름을 확인한다.

**검증**
- `expo-doctor`, typecheck
- iOS 26 시뮬레이터와 Android 에뮬레이터에서 직접 확인한다. Android는 `10.0.2.2:8080`(API)과 `10.0.2.2:5174`(fo-web)로 접속한다.
  1. 검색어와 필터를 바꾸면 결과가 바뀐다.
  2. 북마크하면 마이 화면에 반영된다.
  3. 지원하면 지원활동에 반영된다.
  4. 팔로우하면 팔로우 목록에 반영된다.
  5. 작성한 게시물이 맞는 카테고리에 보인다.
  6. 채팅 응답이 스트리밍된다.
  7. PDF를 업로드하면 저장된다.
  8. 다크 모드와 "투명도 줄이기"에서도 화면이 정상이다.
- 마지막으로 데스크톱 검증을 한 번 더 한다.

## 14. 가정과 리스크

- 서버가 공고 URL을 읽으려 할 때 봇 차단에 걸릴 수 있다. 막히면 텍스트 붙여넣기로 받는다.
- 기업 공고(B)가 처음에는 거의 없다. 홈 탭은 내 공고(A)만으로도 쓸 만해야 한다.
- 이미지는 로컬에서는 디스크에 저장하고, 배포할 때 R2로 바꾼다. DB에는 key만 저장한다.
- core-api와 gateway는 Neon HTTP 드라이버를 쓴다. 로컬 Postgres에 붙이려면 Neon HTTP 프록시가 필요하다.
- `@expo/ui` Android 컴포넌트 이름과 SwiftUI glass 모디파이어 이름은 구현을 시작할 때 `.d.ts`에서 확인한다.

## 15. 개발 원칙

- `develop` 브랜치를 기준으로 한다. 브랜치 이름은 `feat|fix|refactor|chore|docs|test/<short-kebab>`이고, 커밋은 scoped Conventional Commit, 병합은 squash merge로 한다.
- 릴리스는 develop을 main으로 올리는 PR(merge commit)로 한다. push-be는 main에 push하면 배포된다. 마이그레이션은 수동으로 실행한다.
- v2 작업은 `feat/recruiting` 브랜치에서 하고, 승인하기 전에는 develop에 병합하지 않는다.
- 세 저장소(push-workspace, push-fe, push-be)는 서브모듈로 연결하고 커밋을 고정해서 관리한다.

## 16. 미결 사항

- 기업 공고 작성 화면을 어디에 둘지 정해야 한다. fo-web 폼과 앱 화면이 후보다.
- 기업 회원 인증 절차. 사업자 확인을 할지 정해야 한다.
- 백엔드 v2 설계 전체(API 경로, 테이블, 담당 Worker). [api-spec.md](api-spec.md) 4–5장은 초안이다.
- 알림함 화면 디자인(Claude Design에 없음). 알림함은 홈 헤더 글래스 버튼에서 연다.
- 공고별 적합도 계산을 언제, 어디서 할지(백엔드 미확정)
- "이번 주 많이 본 공고"에 필요한 조회수 집계
- 로컬에서 쓸 Neon HTTP 프록시 이미지
- fo-web의 운영 도메인과 CORS 허용 목록. 지금은 `tauri://localhost`와 localhost만 허용한다.
