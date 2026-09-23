# Experiment plan: stream-render + approval-surface

Date: 2026-02-08
Status: draft
Infra: 기존 파이프라인 재사용 (`experiments`, `experiment_assignments`,
`experiment_events`, `useExperiment`, `useExperimentConversion`,
deterministic slot hash, `exclusion_group`)

## 배경

`home-greeting` 사이클은 배정 → 렌더 → 이벤트 → 집계 → 결정 파이프라인을
검증했다. 다음 사이클은 UI 설계 판단 자체를 실험 대상으로 올린다.
대상 2개는 모두 실제 구현이 갈리는 지점이라 결과가 바로 반영된다.

## Experiments

| key | variants | exclusion_group | 대상 |
|---|---|---|---|
| `stream-render` | A, B | `chat-core` | AI 응답 표시 방식 |
| `approval-surface` | A, B | `chat-core` | 승인 UI 진입 형태 |

`chat-core` 그룹으로 묶어 두 실험이 같은 대화 화면에서 겹치지 않게 한다.

### stream-render

- 가설: 토큰 단위 실시간 표시가 완성 후 표시보다 체감 대기를 낮춰
  응답 완독과 후속 대화로 이어진다.
- A: 현재 구현 — 토큰 배칭 스트리밍 표시 (60/s 커밋)
- B: 응답 완료 후 한 번에 렌더
- 측정:
  - exposure: 첫 토큰 렌더 시점
  - conversion: 응답 완료 후 30초 내 후속 메시지 전송
  - guardrail: 응답 중단율(스트림 취소), 평균 응답 길이
- 판정: conversion 차이 two-proportion z-test, p<0.05
- 구현 지점: `chat-stream.tsx`의 배칭 커밋을 variant B에서 스킵.
  백엔드 스트림 자체는 동일 — 표시만 갈라 배선 영향 제거.

### approval-surface

- 가설: 승인 요청을 인라인 카드로 두면 대화 흐름을 읽다가 처리하고,
  모달로 띄우면 발견은 빠르지만 흐름을 끊는다.
- A: 현재 구현 — 대화 타임라인 안 인라인 `ApprovalCard`
- B: 승인 요청 도착 시 모달 다이얼로그
- 측정:
  - exposure: 승인 카드/모달이 화면에 표시된 시점
  - conversion: 승인 또는 거부 결정 완료
  - 1차 지표: exposure → conversion 지연시간(중앙값)
  - guardrail: 미처리 방치율, 거부율 (모달이 승인을 강요하지 않는지)
- 판정: 지연시간 중앙값 비교 + conversion률, p<0.05
- 구현 지점: `ApprovalCard`를 감싸는 컨테이너만 variant 분기.
  카드 본체·결정 API(`useDecideApproval`)는 공유해 판정 로직 오염 제거.

## 이벤트 계약

`experiment_events` 스키마 그대로. event 값:

```text
stream-render:     "exposed", "converted", "aborted"
approval-surface:  "exposed", "converted"
```

latency는 `exposed`/`converted` created_at 차이로 집계 — 별도 필드 없음.

## 절차

1. EXPERIMENTS seed에 2건 추가, `exclusion_group=chat-core`
2. variant 분기 구현 + 이벤트 계측
3. `run_experiment_cycle.py` 패턴으로 synthetic 사이클 1회 —
   파이프라인 회귀 확인용, propensity 주입 없이 방향 미가정
4. 실사용 트래픽에서 2주 또는 variant당 n≥300
5. `GET /api/v1/experiments/{key}/results` 집계, z-test 후 채택/유지 결정

## 리스크

- stream-render B: 스트림 취소 시 부분 응답 미표시 — 완료 전 취소는
  두 variant 모두 동일하게 미표시로 통일해 공정성 확보
- approval-surface B: 모달이 앱 포커스를 뺏음 — 포커스 복원 확인 필수
- synthetic 사이클로 효과 방향을 주장하지 않음 (이전 사이클 교훈)
