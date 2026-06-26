# Load environment variables from .env if it exists
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

# Default fallback variables if not specified in .env
PORT ?= 3000
EXTERNAL_PORT ?= 3000
DB_USER ?= postgres
DB_PASSWORD ?= heslo
DB_NAME ?= torquedash

.PHONY: help up down restart build logs logs-web logs-db status db-shell db-status latest-data latest-sessions latest-users session

help:
	@echo "Available commands:"
	@echo "  make up               - Start the Docker Compose stack in detached mode"
	@echo "  make down             - Stop the Docker Compose stack and remove containers"
	@echo "  make restart          - Restart the Docker Compose stack"
	@echo "  make build            - Rebuild the Docker Compose services"
	@echo "  make logs             - View live logs from all containers"
	@echo "  make logs-web         - View live logs from the web container"
	@echo "  make logs-db          - View live logs from the database container"
	@echo "  make status           - Show status of the containers"
	@echo "  make db-shell         - Open an interactive PostgreSQL psql shell"
	@echo "  make db-status        - Show table sizes and counts in the database"
	@echo "  make latest-data      - Show the 5 latest OBD2 diagnostic log entries"
	@echo "  make latest-sessions  - Show the 5 latest OBD2 telemetry sessions"
	@echo "  make latest-users     - Show the 5 latest registered users"
	@echo "  make session          - Generate and update secure session keys in .env"

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

build:
	docker compose build

logs:
	docker compose logs -f

logs-web:
	docker compose logs -f web

logs-db:
	docker compose logs -f db

status:
	docker compose ps

db-shell:
	docker compose exec db psql -U $(DB_USER) -d $(DB_NAME)

db-status:
	@echo "=== Table Sizes and Storage ==="
	@docker compose exec -T db psql -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) AS total_size FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(quote_ident(table_name)) DESC;"
	@echo "\n=== Table Row Counts ==="
	@docker compose exec -T db psql -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT \
			(SELECT count(*) FROM \"Users\") AS users_count, \
			(SELECT count(*) FROM \"Sessions\") AS sessions_count, \
			(SELECT count(*) FROM \"Logs\") AS logs_count;"

latest-data:
	@echo "=== 5 Most Recent OBD2 Log Data Entries ==="
	@docker compose exec -T db psql -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT id, \"sessionId\", timestamp, lat, lon FROM \"Logs\" ORDER BY timestamp DESC LIMIT 5;"

latest-sessions:
	@echo "=== 5 Most Recent Sessions ==="
	@docker compose exec -T db psql -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT id, \"sessionId\", name, \"createdAt\" FROM \"Sessions\" ORDER BY \"createdAt\" DESC LIMIT 5;"

latest-users:
	@echo "=== 5 Most Recent Registered Users ==="
	@docker compose exec -T db psql -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT id, email, \"createdAt\" FROM \"Users\" ORDER BY \"createdAt\" DESC LIMIT 5;"

session:
	@if [ ! -f .env ]; then echo "No .env file found. Copying .env.example..."; cp .env.example .env; fi
	@KEY1=$$(openssl rand -hex 16) && \
	 KEY2=$$(openssl rand -hex 16) && \
	 KEY3=$$(openssl rand -hex 16) && \
	 KEYS="$$KEY1,$$KEY2,$$KEY3" && \
	 if grep -q "^SESSION_KEYS=" .env; then \
	     sed -i "s|^SESSION_KEYS=.*|SESSION_KEYS=$$KEYS|" .env; \
	 else \
	     echo "SESSION_KEYS=$$KEYS" >> .env; \
	 fi
	@echo "Session keys in .env successfully randomized!"

