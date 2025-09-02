include ./Makefile.variable

# ==================== Database Setup ====================

# Create postgres container
postgrescreate:
	docker run --name ${POSTGRES_CONTAINER_NAME} -p ${DB_INTERNAL_PORT}:${DB_EXTERNAL_PORT} -e POSTGRES_USER=${DB_USER} -e POSTGRES_PASSWORD=${DB_USER_PASSWORD} -d postgres

# Create the Database
dbcreate:
	docker exec -it ${POSTGRES_CONTAINER_NAME} createdb --username=${DB_USER} --owner=${DB_USER} ${DB_NAME}

# Start existing postgres container
dbstart:
	docker start ${POSTGRES_CONTAINER_NAME}

# Stop postgres container
dbstop:
	docker stop ${POSTGRES_CONTAINER_NAME}

# Remove postgres container (WARNING: destroys all data)
dbremove:
	docker rm ${POSTGRES_CONTAINER_NAME}

# Full database setup (container + database)
dbsetup: postgrescreate dbcreate

# ==================== Prisma Operations ====================

# Generate Prisma client
prisma-generate:
	cd web && npx prisma generate

# Push schema to database (development)
prisma-push:
	cd web && npx prisma db push

# Run migrations (production)
prisma-migrate:
	cd web && npx prisma migrate deploy

# Reset database (WARNING: destroys all data)
prisma-reset:
	cd web && npx prisma migrate reset --force

# Seed database with station data
prisma-seed:
	cd web && npx prisma db seed

# Open Prisma Studio
prisma-studio:
	cd web && npx prisma studio

# ==================== Database Utilities ====================

# Connect to database via psql
dbconnect:
	docker exec -it ${POSTGRES_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME}

# Show database status
dbstatus:
	docker ps -f name=${POSTGRES_CONTAINER_NAME}

# Show database logs
dblogs:
	docker logs ${POSTGRES_CONTAINER_NAME}

# Backup database
dbbackup:
	docker exec -t ${POSTGRES_CONTAINER_NAME} pg_dump -U ${DB_USER} ${DB_NAME} > backup_$(shell date +%Y%m%d_%H%M%S).sql

# Restore database from backup (usage: make dbrestore FILE=backup_file.sql)
dbrestore:
	docker exec -i ${POSTGRES_CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME} < ${FILE}

# ==================== Development Workflow ====================

# Complete development setup
dev-setup: dbsetup prisma-push prisma-seed
	@echo "✅ Database setup complete!"
	@echo "🚀 You can now run: cd web && npm run dev"

# Quick reset for development
dev-reset: prisma-reset prisma-seed
	@echo "🔄 Database reset complete!"

# Health check
health:
	@echo "🔍 Checking database health..."
	docker exec ${POSTGRES_CONTAINER_NAME} pg_isready -U ${DB_USER} -d ${DB_NAME}
	@echo "✅ Database is healthy!"

.PHONY: postgrescreate dbcreate dbstart dbstop dbremove dbsetup
.PHONY: prisma-generate prisma-push prisma-migrate prisma-reset prisma-seed prisma-studio
.PHONY: dbconnect dbstatus dblogs dbbackup dbrestore
.PHONY: dev-setup dev-reset health
