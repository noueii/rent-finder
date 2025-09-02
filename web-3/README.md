# Tokyo Apartment Finder

A revolutionary web application that helps users find apartments in Tokyo based on commute time rather than just location. Built with the T3 Stack for a modern, type-safe development experience.

## 🏗️ Architecture Overview

The application follows a clean architecture pattern with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Next.js)                         │
│                 React + TypeScript + tRPC                   │
├─────────────────────────────────────────────────────────────┤
│                    API Layer (tRPC)                         │
│                   Type-safe API endpoints                   │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer                            │
│              Business logic & orchestration                 │
├─────────────────────────────────────────────────────────────┤
│                   Repository Layer                          │
│                 Data access abstraction                     │
├─────────────────────────────────────────────────────────────┤
│                      Database                               │
│                PostgreSQL with Prisma ORM                   │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Features

- **Commute-based Search**: Find apartments within your desired commute time
- **Multi-station Support**: Search from multiple work/school locations
- **Real-time Scraping**: Get up-to-date listings from major property sites
- **Advanced Filters**: Filter by price, size, age, and amenities
- **Saved Searches**: Get notified when new properties match your criteria
- **User Favorites**: Save and compare your favorite properties

## 🛠️ Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: tRPC, Prisma, PostgreSQL
- **Authentication**: NextAuth.js
- **Testing**: Jest, React Testing Library
- **External Services**: Transit API, Property Scrapers, Google Maps

## 📁 Project Structure

```
web-3/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   ├── server/
│   │   ├── api/         # tRPC routers
│   │   ├── services/    # Business logic
│   │   ├── repositories/# Data access layer
│   │   └── db.ts        # Database client
│   ├── lib/             # Utilities
│   └── types/           # TypeScript types
├── prisma/              # Database schema
├── public/              # Static assets
├── docs/                # Documentation
│   ├── PRD.md          # Product requirements
│   ├── PLANNING.md     # Technical planning
│   ├── TASKS.md        # Task breakdown
│   ├── SESSION.md      # Development log
│   └── refactoring/    # Architecture docs
└── __tests__/           # Test files
```

## 🏃 Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- pnpm (recommended) or npm

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/tokyo-apartment-finder.git
cd tokyo-apartment-finder/web-3
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/rentfinder"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# External Services
TRANSIT_API_URL="http://localhost:3001"
GOOGLE_MAPS_API_KEY="your-api-key"
```

5. Run database migrations:
```bash
pnpm prisma migrate dev
```

6. Seed the database (optional):
```bash
pnpm prisma db seed
```

7. Start the development server:
```bash
pnpm dev
```

## 🧪 Testing

Run the test suite:

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## 📚 Documentation

- **[Product Requirements](docs/PRD.md)**: What we're building and why
- **[Technical Planning](docs/PLANNING.md)**: How we're building it
- **[Integration Guide](docs/refactoring/integration-guide.md)**: How components connect
- **[Agent Guidelines](CLAUDE.md)**: Development workflow for AI agents

## 🔧 Key Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm prisma studio    # Open Prisma Studio
pnpm prisma migrate   # Run migrations
pnpm prisma generate  # Generate Prisma client

# Code Quality
pnpm lint            # Run ESLint
pnpm type-check      # Check TypeScript
pnpm format          # Format with Prettier

# Testing
pnpm test            # Run tests
pnpm test:e2e        # Run E2E tests
```

## 🏛️ Architecture Highlights

### Clean Architecture

The application follows clean architecture principles:

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **Dependency Inversion**: Higher layers depend on abstractions, not implementations
3. **Testability**: Each layer can be tested independently
4. **Maintainability**: Changes in one layer don't affect others

### Key Design Patterns

- **Repository Pattern**: Abstracts data access logic
- **Service Pattern**: Encapsulates business logic
- **Factory Pattern**: Creates complex objects (scrapers)
- **Circuit Breaker**: Handles external service failures
- **Caching**: Reduces external API calls

### External Integrations

1. **Transit System**: Calculates reachable stations within commute time
2. **Property Scrapers**: Fetches listings from SUUMO, Homes.co.jp
3. **Geocoding**: Converts addresses to coordinates
4. **Authentication**: Secure user sessions with NextAuth

## 🚀 Deployment

The application can be deployed to various platforms:

### Vercel (Recommended)
```bash
vercel --prod
```

### Docker
```bash
docker build -t tokyo-apartment-finder .
docker run -p 3000:3000 tokyo-apartment-finder
```

### Traditional Hosting
```bash
pnpm build
pnpm start
```

## 🤝 Contributing

1. Check [TASKS.md](docs/TASKS.md) for available tasks
2. Follow the agent guidelines in [CLAUDE.md](CLAUDE.md)
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with the [T3 Stack](https://create.t3.gg/)
- Transit data from Tokyo Metro and JR East
- Property listings from various real estate platforms

---

For more detailed information about the architecture and integration points, see the [Integration Guide](docs/refactoring/integration-guide.md).