# Tokyo Rent Finder - Web Frontend

This is the Next.js frontend application for the Tokyo Rent Finder project.

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **tRPC** - End-to-end type safety for API
- **React Query** - Data fetching and caching
- **Zod** - Schema validation

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env.example .env.local
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
src/
├── app/                 # Next.js app router pages
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
│   ├── SearchForm.tsx  # Search form component
│   ├── SearchResults.tsx # Results display
│   └── ApartmentCard.tsx # Individual apartment card
├── server/            # tRPC server setup
│   └── api/          # API routes and procedures
├── utils/            # Utility functions
└── styles/           # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler

## API Integration

The frontend uses tRPC to communicate with the backend. The main API endpoints are:

- `station.search` - Search for stations
- `apartment.searchByCommute` - Search apartments by commute time
- `system.health` - Health check

## Features

- **Station Search** - Find Tokyo stations by name
- **Commute-based Search** - Find apartments within commute time
- **Responsive Design** - Works on desktop and mobile
- **Type Safety** - Full TypeScript integration
- **Real-time Updates** - Powered by React Query

## Development Notes

- The frontend is designed to work with the backend API
- Mock data is used when the backend is not available
- Components are built with accessibility in mind
- Tailwind CSS is used for consistent styling