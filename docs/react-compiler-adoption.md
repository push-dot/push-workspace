# React Compiler 도입

브랜치 `feat/react-compiler`. 대상: `push-fe`(React 19.3 + Vite 6 + vitest/jsdom).

## 배경

- 스트림 토큰 배칭(`docs/stream-state-store.md`)으로 커밋 빈도는 이미 상한 도달(16ms flush). 남은 비용은 커밋당 하위 트리 재렌더 — `ChatStream`이 렌더될 때마다 모든 `MessageView`(+Markdown)가 재실행됐다.
- 수동 `React.memo`/`useMemo` 대안 검토: 행 단위 memo 래핑과 콜백 안정화를 손으로 유지하는 비용 대비, 컴파일러의 정적 분석 기반 자동 memoize가 우위. 불안정 의존(렌더마다 새로 만들어지는 `useT()`의 `t` 등)도 컴파일 타임에 블록 단위로 분리된다.

## 변경 (push-fe)

- `babel-plugin-react-compiler@1.0.0` devDependency 추가.
- `vite.config.ts`: `react({ babel: { plugins: ['babel-plugin-react-compiler'] } })`. React 19 내장 `compiler-runtime` 사용 — 별도 런타임 패키지 불필요.
- `src/test-utils/render-count.ts`: 이름별 렌더 카운터(`bumpRenderCount`/`getRenderCount`/`resetRenderCounts`). 테스트에서 `react-markdown`을 mock해 호출 시 카운트 — 행 텍스트 접두사(`row-`)로 확정 행 vs 스트림 버블을 구분한다.
- `src/features/chat/render-count.test.tsx`: 스트림/스크롤 두 시나리오 계측 + 회귀 어서션(`row === ROW_COUNT`).

## 측정 조건

vitest + jsdom. React Profiler로 `ChatStream` 서브트리 커밋 수, mock `Markdown` 호출 수로 리프 서브트리 렌더 수를 계측.

- 스트림: 토큰 120개, 토큰당 별도 macrotask(4ms 간격), assistant 행 8개 선시딩 후 `send`→`done`.
- 스크롤: assistant 행 8개, `.chat-vlist`에 scrollHeight=2000/clientHeight=500을 주고 scrollTop 0↔1600 교대 4쌍 → `showJump` 토글로 커밋 9회 유발.

## 결과

| 시나리오 | 지표 | 전 | 후 |
| --- | --- | --- | --- |
| 스트림 | 트리 커밋 | 33 | 33 |
| 스트림 | 확정 행 Markdown 렌더 | 32 | 8 |
| 스트림 | 스트림 버블 Markdown 렌더 | 31 | 31 |
| 스크롤 | 트리 커밋 | 9 | 9 |
| 스크롤 | 확정 행 Markdown 렌더 | 72 | 8 |

- 커밋 수 불변: 커밋 빈도 상한은 외부 스토어 배칭이 계속 담당 — 컴파일러는 스토어→구독자 알림을 합치지 않는다(의도된 공존).
- 확정 행 렌더 -75%(스트림)/-89%(스크롤): `MessageView` 서브트리가 자동 memoize되어 `sendStatus`/`showJump` 변경 커밋이 행에 fan-out하지 않는다.
- 버블 렌더 불변(31): leaf 구독은 flush당 1회 렌더 — 정상.

## 컴파일러가 못 덮는 부분 (수동 확인)

- 외부 스토어 구독 범위: `streamText`/`streamStatus`는 `StreamingBubble`만 구독(`chat-stream.tsx`), `ChatPage`/`ChatStream`은 미구독. 컴파일러는 구독 범위를 좁혀주지 않으므로 leaf 구독 설계 유지가 전제.
- 리스트 렌더 경계: zustand 불변 업데이트로 `messages` 항목 객체 identity가 유지되는 것이 전제 — 스토어에서 객체를 재생성하면 memo miss.
- `useT()`의 `t`는 렌더마다 새 함수라 불안정 의존이지만, 컴파일러가 `Markdown` 블록을 `message.text` 키로 분리 캐시해 행 본문은 안정 유지(측정으로 확인).

## 회귀 테스트

- `render-count.test.tsx`의 `row === ROW_COUNT` 어서션이 컴파일러 OFF에서는 red(스트림 32, 스크롤 72), ON에서는 green(8/8). 컴파일러 비활성화 또는 수동 memo 회귀 시 즉시 실패.

## 검증 로그

- `npm test` 37/37 pass, `npm run typecheck` clean, `npm run lint` 0 errors(68 warnings — develop과 동일, 전부 기존 react-refresh 경고), `npm run build` 성공. 번들에 `react/compiler-runtime` import + `useMemoCache` 6곳 확인.
- 깨진 테스트 없음 — 기존 35개 + 신규 2개 전부 통과.

## 알려진 한계

- 커밋 빈도 자체는 외부 스토어 배칭에 의존 — 컴파일러는 스토어 알림을 합치지 않는다.
- jsdom 계측이라 실기기 절대 비용과 차이가 있음 — 행 Markdown 재렌더 제거 효과는 실기기에서 더 클 것으로 예상.
