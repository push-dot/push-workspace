# Experiment cycle: home-greeting

Date: 2026-09-21
Branch: feat/experiment-results
Environment: local PostgreSQL 18 (`push` db, port 5434), API on :8080,
`APP_ENV=development`, dev auth token.

## Setup

EXPERIMENTS seed:

```json
[
  {"key": "home-greeting", "variants": ["A", "B"], "exclusion_group": "home-hero"},
  {"key": "home-cta", "variants": ["A", "B"], "exclusion_group": "home-hero"}
]
```

`home-greeting` and `home-cta` share `exclusion_group=home-hero`, so each
user enrolls in at most one of the two via deterministic slot hash
`sha256(user_id:group) % group_size`.

Traffic: 2000 synthetic users driven through `ExperimentService`
(`scripts/run_experiment_cycle.py`). Conversion propensity was injected per
variant (greeting A=0.20, B=0.32; cta A=B=0.10) because no real user traffic
exists yet. All reported numbers are measured from `experiment_events` rows
and the live `GET /api/v1/experiments/{key}/results` endpoint, not estimated.

## Consistency checks

- Exclusion violations (user enrolled in both group experiments): **0 / 2000**
- Enrollment split: home-greeting 1016, home-cta 984 (sum = 2000)
- Aggregation parity: results sums equal raw `experiment_events` row counts
  (exposed 490+526=1016 rows; converted 85+152=237 rows)

## Results (measured)

| Experiment | Variant | Exposed | Converted | Rate |
|---|---|---|---|---|
| home-greeting | A | 490 | 85 | 17.35% |
| home-greeting | B | 526 | 152 | 28.90% |
| home-cta | A | 484 | 55 | 11.36% |
| home-cta | B | 500 | 54 | 10.80% |

Two-proportion z-test on home-greeting: pooled p=0.233, SE=0.0265,
z=4.37, p<0.0001.

## Results API latency

`GET /api/v1/experiments/home-greeting/results`, n=200 sequential calls:
p50=1.32ms, p95=1.50ms.

## Decision

**Adopt variant B** for `home-greeting` (28.90% vs 17.35% conversion,
statistically significant). Caveat: traffic is synthetic; the injected
propensity gap guarantees direction, so this cycle validates the
pipeline (assignment -> render -> events -> aggregation -> decision)
rather than measuring a real treatment effect. Re-run against real
traffic before rolling out broadly.

`home-cta` shows no variant difference (11.36% vs 10.80%), consistent with
its equal injected propensity — keep A.

## Infra notes

- `experiments.exclusion_group` added in migration `0010_experiment_groups.sql`.
- Assignment responses carry `enrolled`; excluded users get the default
  variant with `enrolled=false`, no persisted assignment, and their events
  are dropped in `record_event`.
- Results are computed live from `experiment_events`
  (`COUNT(DISTINCT user_id) FILTER ...`); no pre-aggregation table.
- Local pgvector was missing for homebrew postgresql@16; the run used a
  throwaway postgresql@18 cluster at `/tmp/push-pg18` on port 5434.
