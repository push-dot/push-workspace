# SSE 토큰 스트림 상태 아키텍처

브랜치 `feat/stream-state-store`. 대상: `push-fe`(React 19 + Zustand + TanStack Query), `push-be`(FastAPI + `chat_events`).

## 문제

- 토큰 이벤트마다 `useMessagesStore.set({ streamText })` → `ChatPage`와 `ChatStream` 전체(메시지 목록 + Markdown)가 토큰당 1회 렌더.
- 네트워크 단절 시 재연결 로직 없음. `for await`가 예외로 끝나면 `catch {}`가 삼키고, abort가 아니면 `sendStatus='streaming'`과 잘린 `streamText`가 그대로 남음.
- `stream/active`는 `chat_events`를 항상 `id>0`부터 재생 — 재접속 시 처음부터 다시 받음.

## 변경

### push-be (`feat/stream-state-store`)

- `chat_events.id`(bigserial)를 SSE 프레임 `seq`로 노출. `_pump_job_events`가 `(kind, payload, seq)` 3-튜플 yield, `_sse_frames`가 `seq != null`일 때 `"seq"` 필드 추가.
- `GET /conversations/{id}/messages/stream/active?after=<seq>` — `events_since(job_id, after)`로 커서 이후만 재생.
- 비큐 모드(워커 없음)의 `stream_message`는 `seq=None` — 지속화된 이벤트가 없으므로 재생 불가, 클라이언트는 seq 없는 이벤트를 항상 적용.

### push-fe

- `stores.ts` 내부에 외부 버퍼(`buf`) 도입. 토큰은 `buf.text`에 누적만 하고 `STREAM_FLUSH_MS=16` 타이머로 flush → `set()` 호출이 초당 ~62.5회로 상한.
- `StreamingBubble`이 `streamText`/`streamStatus`를 직접 구독(leaf 구독). `ChatPage`/`ChatStream`은 스트림 상태를 구독하지 않아 flush당 커밋은 버블 서브트리에 한정. 스크롤 핀은 `onGrow` 콜백으로 유지.
- `lastSeq` 커서: `ev.seq <= lastSeq` 이벤트는 드롭(중복 0), 아니면 커서 전진.
- 재연결: 스트림 예외('dropped') 시 `STREAM_RECONNECT_MS=200` 간격, 최대 `STREAM_MAX_RECONNECTS=5`회 `stream/active?after=lastSeq`로 재생→라이브 전환. `send`의 POST 스트림이 끊겨도 같은 경로로 재개(큐 모드에서 잡은 `seq`가 있으면 그 지점부터).
- 완료(`done`) 시점에만 `messages` 확정(`commitDone`). 스트림 중 `streamText`는 임시 상태. 메시지는 TanStack Query가 아닌 Zustand가 소스이므로 `setQueryData` 대신 동일 시맨틱(완료 시 확정)을 스토어에 적용 — 기존 `listMessages`는 RQ 캐시를 타지 않음.
- 스트림이 `done` 없이 깨끗이 종료('ended')되면 버퍼가 있을 때 `listMessages`로 재조정 — 잡 종료와 프레임 유실의 경계 케이스 커버.

## 측정 (vitest + jsdom, React Profiler 커밋 카운트)

시나리오: 토큰 120개, 토큰당 별도 macrotask(4ms 간격)로 도착, `send` → `done`까지 `ChatStream` 서브트리 커밋 수.

| | 커밋 | 경과 | 커밋/초 |
| --- | --- | --- | --- |
| 전 (토큰당 setState) | 123 | 558ms | ~220 |
| 후 (16ms 배칭 + leaf 구독) | 33 | 549ms | ~60 |

- 상한 검증: `commits <= ceil(elapsed/16ms) + 4` — 실제 33 <= 38.
- INP는 브라우저 없이 측정 불가 → 커밋/초와 배칭 상한으로 대체. jsdom 렌더 비용이 실제 기기보다 작으므로 실기기에서는 전/후 격차가 더 클 것(토큰당 전체 Markdown 재렌더 제거).

## 재연결 정합성 (vitest, `stream-reconnect.test.ts`)

| 테스트 | 결과 |
| --- | --- |
| 단절 후 `after=lastSeq`로 재개, 중복 seq 재전송 시 드롭 → 유실 0, 중복 0 | pass |
| 재연결 경계 전후 토큰 순서 일치(증가 접두사) | pass |
| `send` 스트림 단절 → `stream/active`로 재개 → `done` 확정 | pass |
| `done` 없는 정상 종료 → `listMessages` 재조정 | pass |

백엔드: `stream_active(after=)`가 커서 이후 이벤트만 seq와 함께 재생하는지 pytest로 검증(`test_stream_active_replays_only_events_after_cursor`).

## 검증 로그

- `push-fe`: `npm test` 35/35 pass, `npm run typecheck` clean, `npm run lint` 0 errors.
- `push-be`: `pytest tests` 98/98 pass.

## 알려진 한계

- 비큐 모드(로컬 stub/워커 미기동)는 `chat_events` 미사용이라 재생 불가 — seq 없는 프레임으로 동작, 단절 시 기존 실패 경로.
- 잡 재큐(attempt<3) 시 그래프가 처음부터 재실행되면 토큰이 새 seq로 재방출될 수 있음 — 서버 측 재실행 정책 문제, 본 변경 범위 밖.
