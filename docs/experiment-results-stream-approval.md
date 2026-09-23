# Experiment cycle: stream-render + approval-surface

Date: 2026-09-23
Script: `push-be/scripts/run_experiment_cycle.py`
Environment: local PostgreSQL 18 (`push` db, port 5434), API on :8080,
`APP_ENV=development`, dev auth token.
Plan: `docs/experiment-plan-streaming-approval.md`

## Setup

- Simulated users: 2,000
- Experiments: `home-greeting`, `home-cta` (group `home-hero`),
  `stream-render`, `approval-surface` (group `chat-core`)
- Variants: A/B per experiment, deterministic assignment by user id
- Events: `exposure`, `conversion`, `aborted` (stream-render only)
- Propensity: home-greeting A=0.20/B=0.32, home-cta A=0.10/B=0.10,
  new experiments neutral 0.5 (no planted effect)

## Results

Exclusion-group violations: **0**. Each user entered at most one
experiment per group (`chat-core` split: stream-render 971 +
approval-surface 1029 ≈ 2,000).

| experiment        | variant | exposed | converted | rate   | aborted |
|-------------------|---------|---------|-----------|--------|---------|
| stream-render     | A       | 485     | 242       | 49.9%  | 50      |
| stream-render     | B       | 486     | 249       | 51.2%  | 42      |
| approval-surface  | A       | 525     | 268       | 51.0%  | —       |
| approval-surface  | B       | 504     | 255       | 50.6%  | —       |
| home-greeting     | A       | 470     | 87        | 18.5%  | —       |
| home-greeting     | B       | 514     | 165       | 32.1%  | —       |
| home-cta          | A       | 518     | 49        | 9.5%   | —       |
| home-cta          | B       | 498     | 63        | 12.7%  | —       |

Results API latency: p50 = 1.35 ms, p95 = 1.59 ms (n = 200 calls).

## Reading

- `stream-render`: conversion difference +1.3pp, abort rate A 10.3% vs
  B 8.6%. Both inside noise for neutral propensity — no adoption
  signal, keep A (batched streaming) as default.
- `approval-surface`: conversion difference −0.5pp, no decision signal.
  Keep A (inline card).
- `home-greeting` reproduced the planted effect (B 32.1% > A 18.5%),
  confirming the pipeline still detects a real difference when one is
  planted.
- Guardrail events (`aborted`) recorded per variant, so a variant with
  better conversion but worse aborts would be caught instead of
  adopted on conversion alone.

## Limitations

- Traffic is synthetic; propensity for the new experiments is neutral
  by construction, so this cycle validates the pipeline (assignment,
  exclusion, event recording, results API) rather than producing a
  product decision. Re-run on real traffic before adopting any
  variant.
