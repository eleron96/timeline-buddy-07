.PHONY: help up down logs up-prod down-prod logs-prod audit-migrations deploy-remote

help:
	@printf "Targets:\n  up\n  down\n  logs\n  up-prod\n  down-prod\n  logs-prod\n  audit-migrations\n  deploy-remote\n"

up:
	./infra/scripts/dev-compose.sh

down:
	docker compose -f infra/docker-compose.yml --env-file .env down

logs:
	docker compose -f infra/docker-compose.yml --env-file .env logs -f

up-prod:
	./infra/scripts/prod-compose.sh

down-prod:
	docker compose -f infra/docker-compose.prod.yml --env-file .env down

logs-prod:
	docker compose -f infra/docker-compose.prod.yml --env-file .env logs -f

audit-migrations:
	./infra/scripts/audit-migrations.sh

deploy-remote:
	./infra/scripts/deploy-remote.sh
