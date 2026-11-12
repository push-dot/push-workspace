# 각 서브모듈 README와 CI가 쓰는 명령을 그대로 부른다.
# api는 로컬 Postgres(push-be/infra/docker-compose.yml, 호스트 5434)를 기본으로 본다.
# 다른 DB를 쓰려면 DATABASE_URL을 넘긴다. 예: make api DATABASE_URL=postgres://...

.PHONY: setup install db api gateway core web mobile test test-fe test-ai test-workers legal-check

BE := push-be
FE := push-fe
AI := $(BE)/services/ai

DATABASE_URL ?= postgres://push:push@localhost:5434/push?sslmode=disable
API_PORT ?= 8080

setup:
	git submodule update --init --recursive
	$(MAKE) install

install:
	pnpm --dir $(FE) install --frozen-lockfile
	cd $(BE) && npm ci
	cd $(AI) && uv sync --locked --extra local --extra test

db:
	docker compose -f $(BE)/infra/docker-compose.yml up -d postgres

api:
	cd $(AI) && DATABASE_URL='$(DATABASE_URL)' DB_DRIVER=asyncpg PG_TRANSPORT=tcp \
		APP_ENV=development RUN_MIGRATIONS=1 PYTHONPATH=src \
		uv run --locked --extra local uvicorn app.main:app --host 0.0.0.0 --port $(API_PORT)

gateway:
	cd $(BE)/services/gateway && npx wrangler dev

core:
	cd $(BE)/services/core-api && npx wrangler dev --port 8788 --inspector-port 9230

web:
	pnpm --dir $(FE) --filter @push/fo-web dev

mobile:
	pnpm --dir $(FE) --filter @push/fo-mobile start

test: test-fe test-workers test-ai

test-fe:
	pnpm --dir $(FE) install --frozen-lockfile
	cd $(FE) && pnpm exec turbo run typecheck lint test
	pnpm --dir $(FE) --filter @push/fo-web build

test-workers:
	cd $(BE) && npm ci && npm test && npm run typecheck

test-ai:
	cd $(AI) && uv sync --locked --no-dev --extra test && uv run --no-sync python -m pytest

LEGAL_MD = push-fe/packages/shared/src/legal/md

legal-check:
	diff -u $(LEGAL_MD)/termsOfService.md docs/legal/terms-of-service.md
	diff -u $(LEGAL_MD)/privacyPolicy.md docs/legal/privacy-policy.md
	diff -u $(LEGAL_MD)/privacyConsent.md docs/legal/privacy-consent.md
	diff -u $(LEGAL_MD)/marketingConsent.md docs/legal/marketing-consent.md
