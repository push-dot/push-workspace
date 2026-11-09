.PHONY: api web test legal-check

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

LEGAL_MD = push-fe/packages/shared/src/legal/md

legal-check:
	diff -u $(LEGAL_MD)/termsOfService.md docs/legal/terms-of-service.md
	diff -u $(LEGAL_MD)/privacyPolicy.md docs/legal/privacy-policy.md
	diff -u $(LEGAL_MD)/privacyConsent.md docs/legal/privacy-consent.md
	diff -u $(LEGAL_MD)/marketingConsent.md docs/legal/marketing-consent.md
