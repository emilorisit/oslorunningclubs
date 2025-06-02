# Oslo Running Calendar

A dynamic web application that aggregates and displays running events from Strava clubs in Oslo, providing comprehensive event discovery and connection tools for local runners.

## Features

- **Event Discovery**: Centralized view of running events from multiple Strava clubs
- **Smart Filtering**: Filter events by pace, distance, and difficulty level
- **Calendar Views**: Month, week, and list views for event visualization
- **Club Management**: Registration system for running clubs with verification
- **User Preferences**: Personalized event filtering and hiding capabilities
- **Real-time Sync**: Background synchronization with Strava data

## Tech Stack

- **Frontend**: React + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **API Integration**: Strava API with resilient client architecture
- **Caching**: Multi-tier caching with automatic invalidation

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
DATABASE_URL=postgresql://user:password@host:port/database
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
```

3. Initialize database:
```bash
npm run db:push
```

4. Start development server:
```bash
npm run dev
```

## Project Structure

```
├── client/                 # React frontend
│   ├── src/components/    # UI components
│   ├── src/pages/         # Route pages
│   └── src/lib/          # Utilities
├── server/                # Express backend
│   ├── routes.ts         # API endpoints
│   ├── db-storage.ts     # Database operations
│   └── cache-service.ts  # Caching layer
└── shared/               # Shared types and schemas
    └── schema.ts        # Database schema
```

## Key Components

### Resilient API Integration
- Rate limiting and retry logic with exponential backoff
- Circuit breaker pattern for fault tolerance
- Automatic rate limit management

### Caching Strategy
- Multi-tier caching with intelligent invalidation
- TTL management per data type
- Cache-aside pattern implementation

### Type-Safe Database Layer
- Drizzle ORM with Zod validation
- Parameterized queries for security
- Comprehensive schema with proper constraints

## License

MIT License - see LICENSE file for details