.PHONY: api web test

api:
	cd push-be && uvicorn app.main:app --host 0.0.0.0 --port 8080

web:
	npm --prefix push-fe run dev

test:
	cd push-be && python -m pytest
	npm --prefix push-fe test
	npm --prefix push-fe run lint
	npm --prefix push-fe run typecheck
	npm --prefix push-fe run build
