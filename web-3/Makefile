.PHONY: help
help: ## Show this help message
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

.PHONY: dev
dev: ## Start development server
	npm run dev

.PHONY: db-up
db-up: ## Start PostgreSQL database
	docker-compose up -d postgres

.PHONY: db-down
db-down: ## Stop PostgreSQL database
	docker-compose down

.PHONY: db-reset
db-reset: ## Reset database (warning: destroys all data)
	docker-compose down -v
	docker-compose up -d postgres
	sleep 5
	npx prisma db push --force-reset

.PHONY: db-migrate
db-migrate: ## Run database migrations
	npx prisma migrate dev

.PHONY: db-seed
db-seed: ## Seed database with initial data
	npx prisma db seed

.PHONY: db-studio
db-studio: ## Open Prisma Studio
	npx prisma studio

.PHONY: db-tools
db-tools: ## Start database tools (Prisma Studio, pgAdmin)
	docker-compose -f docker-compose.yml -f docker-compose.dev.yml --profile tools up -d

.PHONY: type-check
type-check: ## Run TypeScript type checking
	npm run type-check

.PHONY: lint
lint: ## Run ESLint
	npm run lint

.PHONY: format
format: ## Format code with Prettier
	npm run format

.PHONY: test
test: ## Run tests
	npm test

.PHONY: build
build: ## Build production bundle
	npm run build

.PHONY: clean
clean: ## Clean build artifacts
	rm -rf .next node_modules

.PHONY: install
install: ## Install dependencies
	npm install