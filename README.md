# Oslo Running Calendar

A sophisticated event aggregation platform that integrates with Strava's API to centralize running club events across Oslo, providing comprehensive event discovery and connection tools for local runners.

## 🏗️ Architecture Overview

This enterprise-grade application demonstrates modern full-stack development practices with robust API integration, caching strategies, and fault-tolerant design patterns.

### Tech Stack
- **Frontend**: React 18 + TypeScript + TailwindCSS + shadcn/ui
- **Backend**: Node.js + Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **API Integration**: Strava API v3 with resilient client
- **Caching**: Multi-tier caching with automatic invalidation
- **Authentication**: OAuth 2.0 (Strava)

## 🚀 Key Features

### Event Management
- **Centralized Event Discovery**: Aggregates running events from multiple Strava clubs
- **Advanced Filtering**: Filter by pace categories, distance ranges, beginner-friendly options
- **Smart Event Processing**: Intelligent parsing of event descriptions for pace and training type detection
- **Calendar Integration**: Multiple view modes (month, week, list) for event visualization

### Club Management
- **Club Registration**: Secure club submission with email verification
- **Automated Scoring**: Dynamic club scoring based on activity, recency, and engagement
- **Statistics Tracking**: Comprehensive metrics for events, participants, and frequency

### User Experience
- **Personalized Views**: User preferences for filtering and calendar display
- **Event Hiding**: Personal event management capabilities
- **Responsive Design**: Mobile-first responsive interface
- **Real-time Updates**: Background synchronization with Strava data

## 🏛️ Enterprise Architecture Patterns

### Resilient API Integration
```typescript
// Sophisticated rate limiting and retry logic
export class ResilientApiClient {
  private rateLimitRemaining = 100;
  private requestQueue: QueueItem[] = [];
  private baseDelay = 1000;
  private maxRetries = 5;
  
  // Exponential backoff with jitter
  // Circuit breaker pattern implementation
  // Automatic rate limit management
}
```

### Multi-Tier Caching Strategy
```typescript
// Cache service with intelligent invalidation
export class CacheService {
  private eventCache: NodeCache;
  private clubCache: NodeCache;
  
  // Hierarchical cache keys for granular invalidation
  // TTL management per data type
  // Cache-aside pattern implementation
}
```

### Type-Safe Database Layer
```typescript
// Drizzle ORM with Zod validation
export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  stravaClubId: text("strava_club_id").notNull().unique(),
  // Comprehensive schema with proper constraints
});
```

## 🔧 Installation & Setup

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Strava API credentials

### Environment Variables
```bash
DATABASE_URL=postgresql://user:password@host:port/database
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
```

### Quick Start
```bash
# Install dependencies
npm install

# Set up database
npm run db:push

# Start development server
npm run dev
```

## 🏗️ Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route-based pages
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/          # Utilities and types
├── server/                # Express backend
│   ├── cache-service.ts  # Caching layer
│   ├── resilient-api.ts  # API client with fault tolerance
│   ├── db-storage.ts     # Database operations
│   ├── cached-storage.ts # Cache-aware storage wrapper
│   └── routes.ts         # API endpoints
├── shared/               # Shared types and schemas
│   └── schema.ts        # Drizzle schema definitions
└── scripts/             # Database maintenance scripts
```

## 🔐 Security & Compliance

### Data Protection
- **Secure Token Management**: Encrypted storage with automatic refresh
- **Input Validation**: Comprehensive Zod schema validation
- **SQL Injection Prevention**: Parameterized queries via Drizzle ORM
- **Rate Limiting**: Built-in protection against API abuse

### Authentication & Authorization
- **OAuth 2.0 Flow**: Secure Strava integration
- **Session Management**: Express sessions with PostgreSQL store
- **CSRF Protection**: Built-in request validation

### Audit & Monitoring
- **Structured Logging**: Comprehensive audit trails
- **Error Tracking**: Detailed error logging with metadata
- **Performance Monitoring**: Request timing and cache hit rates

## 📊 Performance Optimizations

### Database Efficiency
- **Optimized Queries**: Efficient JOIN operations and indexing
- **Connection Pooling**: Managed database connections
- **Query Result Caching**: Intelligent cache invalidation strategies

### API Integration
- **Request Batching**: Efficient bulk operations
- **Intelligent Retries**: Exponential backoff with jitter
- **Rate Limit Awareness**: Proactive throttling

### Frontend Performance
- **Code Splitting**: Lazy-loaded route components
- **Optimistic Updates**: Immediate UI feedback
- **Efficient Re-renders**: React Query for state management

## 🔄 Data Flow Architecture

```
React Frontend → Express API → Cache Layer → Database Storage
                     ↓
             Strava API Client → Strava API
                     ↑
            Background Sync Service
```

## 🛠️ Development Scripts

```bash
# Database operations
npm run db:push          # Push schema changes
npm run db:studio        # Open Drizzle Studio

# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run type-check       # TypeScript validation

# Maintenance
npm run clean-events     # Clean old events
npm run fix-dates        # Fix event timestamps
```

## 🚀 Deployment Considerations

### Production Requirements
- **PostgreSQL**: Version 14+ with connection pooling
- **Node.js**: Version 18+ with PM2 process management
- **SSL/TLS**: HTTPS termination with proper certificates
- **Environment**: Secure environment variable management

### Scaling Strategies
- **Horizontal Scaling**: Stateless design enables load balancing
- **Database Optimization**: Read replicas for query distribution
- **CDN Integration**: Static asset optimization
- **Caching Layers**: Redis for distributed caching

## 📈 Monitoring & Analytics

### Application Metrics
- API response times and error rates
- Cache hit/miss ratios
- Database query performance
- Strava API rate limit utilization

### Business Metrics
- Event discovery rates
- Club engagement scores
- User retention analytics
- Geographic event distribution

## 🤝 Contributing

This project demonstrates enterprise-level development practices including:
- Comprehensive error handling and recovery
- Type-safe development with TypeScript
- Robust testing strategies
- Performance optimization techniques
- Security best practices

## 📄 License

MIT License - see LICENSE file for details

---

**Built with enterprise-grade practices for production reliability and scalability.**