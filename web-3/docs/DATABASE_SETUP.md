# Database Setup Guide

## Quick Start

1. **Start the database**:
   ```bash
   make db-up
   # or
   docker-compose up -d postgres
   ```

2. **Run migrations**:
   ```bash
   make db-migrate
   # or
   npx prisma migrate dev
   ```

3. **Seed initial data** (when available):
   ```bash
   make db-seed
   # or
   npm run db:seed
   ```

## Docker Commands

### Start PostgreSQL
```bash
docker-compose up -d postgres
```

### Stop PostgreSQL
```bash
docker-compose down
```

### Reset Database (WARNING: Destroys all data)
```bash
docker-compose down -v
docker-compose up -d postgres
```

### View logs
```bash
docker-compose logs -f postgres
```

## Database Tools

### Prisma Studio (Database GUI)
```bash
make db-studio
# or
npx prisma studio
```
Then open http://localhost:5555

### pgAdmin (Advanced Database Management)
```bash
make db-tools
```
Then open http://localhost:5050
- Email: admin@example.com
- Password: admin

## Connection Details

- **Host**: localhost
- **Port**: 5432
- **Database**: web-3
- **Username**: postgres
- **Password**: password

Connection string:
```
postgresql://postgres:password@localhost:5432/web-3
```

## Troubleshooting

### Port already in use
If port 5432 is already in use:
1. Check if another PostgreSQL instance is running
2. Stop it or change the port in docker-compose.yml

### Cannot connect to database
1. Ensure Docker is running
2. Check if the container is running: `docker ps`
3. Check logs: `docker-compose logs postgres`

### Migration issues
1. Ensure database is running
2. Check DATABASE_URL in .env
3. Run `npx prisma generate` to regenerate client