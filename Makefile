.PHONY: help dev build lint clean infra-up infra-down db-migrate db-seed db-studio

help:
	@echo "EVOC Creator Platform - Developer Commands"
	@echo "------------------------------------------"
	@echo "make infra-up     : Start Postgres & Redis containers in background"
	@echo "make infra-down   : Stop Postgres & Redis containers"
	@echo "make dev          : Start all apps and services in development mode"
	@echo "make build        : Build all apps and packages"
	@echo "make db-migrate   : Run Prisma database migrations"
	@echo "make db-seed      : Seed database with sample creators & merchants"
	@echo "make db-studio    : Open Prisma Studio web visualizer"
	@echo "make lint         : Run linter across all projects"
	@echo "make clean        : Wipe build caches and artifacts"

infra-up:
	docker compose -f infra/docker-compose.infra.yml up -d

infra-down:
	docker compose -f infra/docker-compose.infra.yml down

dev:
	pnpm dev

build:
	pnpm build

db-migrate:
	pnpm db:migrate

db-seed:
	pnpm db:seed

db-studio:
	pnpm db:studio

lint:
	pnpm lint

clean:
	pnpm clean
