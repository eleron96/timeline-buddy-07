.PHONY: help up down logs

help:
	@printf "Targets:\n  up\n  down\n  logs\n"

up:
	./scripts/dev-compose.sh

down:
	docker compose down

logs:
	docker compose logs -f
