.PHONY: help up down logs

help:
	@printf "Targets:\n  up\n  down\n  logs\n"

up:
	./infra/scripts/dev-compose.sh

down:
	docker compose -f infra/docker-compose.yml --env-file .env down

logs:
	docker compose -f infra/docker-compose.yml --env-file .env logs -f
