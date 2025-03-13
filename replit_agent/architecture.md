# Architecture Overview

## 1. Overview

This project is a full-stack web application called "Oslo Running Calendar" that allows users to view and manage running club events in Oslo. The application integrates with Strava's API to fetch and display running events from various clubs. It consists of a React-based frontend and a Node.js/Express backend, with a PostgreSQL database for data storage.

The app serves as a centralized directory for running clubs and their events, enabling runners to discover local running groups, view upcoming events, and filter them based on preferences like pace and distance.

## 2. System Architecture

The application follows a traditional client-server architecture with three main layers:

1. **Frontend**: React-based SPA with TailwindCSS and Shadcn UI components
2. **Backend**: Express.js server with RESTful API endpoints
3. **Database**: PostgreSQL database managed through Drizzle ORM

### Key Architecture Decisions:

- **Monorepo Structure**: The project uses a monorepo approach with both client and server code in the same repository, sharing common types and schemas in a `shared` directory.
- **TypeScript**: Used throughout the codebase for type safety and better developer experience.
- **API-First Design**: Clear separation between frontend and backend with a well-defined API contract.
- **ORM with Schema Validation**: Drizzle ORM coupled with Zod for database operations and validation.
- **Third-party Authentication**: Leverages Strava OAuth for user authentication.

## 3. Key Components

### 3.1. Frontend Architecture

The frontend is built with:

- **React**: Core UI library
- **TailwindCSS**: For styling
- **Shadcn UI**: Component library built on Radix UI primitives
- **React Query**: For data fetching, caching, and state management
- **Wouter**: Lightweight routing solution
- **React Hook Form**: Form handling with Zod validation

Directory structure:
- `client/src/components/`: UI components
- `client/src/pages/`: Route-based page components
- `client/src/hooks/`: Custom React hooks
- `client/src/lib/`: Utility functions and type definitions

### 3.2. Backend Architecture

The backend is built with:

- **Express.js**: Web server framework
- **Node.js**: Runtime environment
- **Drizzle ORM**: Database access and schema management
- **Zod**: Runtime schema validation

Directory structure:
- `server/`: Contains all server-side code
- `server/routes.ts`: API endpoint definitions
- `server/storage.ts`: Data access layer abstraction
- `server/db.ts`: Database connection and initialization
- `server/strava.ts`: Strava API integration service

### 3.3. Database Schema

The database schema consists of five main tables:

1. **Clubs**: Stores information about running clubs (name, Strava ID, admin email, etc.)
2. **Events**: Running events organized by clubs (title, start time, location, etc.)
3. **Users**: Users who have authenticated with Strava
4. **UserPreferences**: User-specific settings and preferences
5. **HiddenEvents**: Events that users have chosen to hide

The database uses PostgreSQL with Drizzle ORM for schema definition and migrations.

### 3.4. Authentication System

The application uses Strava OAuth for authentication:

1. Users connect their Strava account via OAuth flow
2. The backend exchanges the authorization code for access/refresh tokens
3. Tokens are stored in both the database (for club admins) and localStorage (for users)
4. API requests include the token for authorization when needed

## 4. Data Flow

### 4.1. Event Data Flow

1. **Strava Integration**:
   - Clubs connect their Strava accounts
   - Backend fetches events from Strava API using stored access tokens
   - Events are normalized and stored in the database
   - Background sync service (`sync-service.ts`) periodically refreshes the data

2. **Event Discovery Flow**:
   - Users visit the calendar page
   - Frontend fetches events from the backend API with filters
   - Events are displayed in a calendar view or list view
   - Users can apply filters (pace, distance, club)

3. **Club Directory Flow**:
   - Backend calculates club activity scores based on event frequency and participation
   - Frontend displays clubs sorted by activity score
   - Users can search for clubs by name

## 5. External Dependencies

### 5.1. Strava API Integration

The application relies heavily on Strava's API for:
- User authentication via OAuth
- Fetching club information
- Retrieving club events
- Maintaining event synchronization

### 5.2. Google Services

The application uses several Google services:
- **Google Analytics**: For tracking user behavior
- **Google AdSense**: For displaying advertisements
- **Google Consent Management**: For GDPR compliance

### 5.3. Email Service

A nodemailer setup for sending emails is included for:
- Club verification
- Notifications
- Administrative communications

## 6. Deployment Strategy

The application is configured for deployment on Replit with the following strategy:

1. **Build Process**:
   - Frontend built with Vite
   - Backend bundled with esbuild
   - Combined into a single distributable package

2. **Database**:
   - Uses Neon PostgreSQL (serverless Postgres) as indicated by the connection settings

3. **Environment Configuration**:
   - Uses environment variables for configuration
   - Handles both development and production environments
   - Special handling for Replit environment

4. **Scaling Considerations**:
   - Designed for moderate load (Oslo regional audience)
   - Uses serverless database for automatic scaling
   - Implements caching for Strava API responses to reduce rate limiting issues

### CI/CD Pipeline

The deployment process is defined in `.replit` and configured for:
- Automatic installation of dependencies
- Building both frontend and backend
- Starting the application with the appropriate environment
- Port configuration for external access

## 7. Performance Optimization

1. **API Response Caching**:
   - Strava API responses are cached to prevent rate limiting
   - Frequently accessed data is stored in memory for quick access

2. **Frontend Optimizations**:
   - React Query for efficient data fetching and caching
   - Lazy loading of components where appropriate
   - Pagination for large data sets

3. **Database Optimizations**:
   - Indexes on frequently queried fields
   - Efficient query patterns through the ORM

## 8. Future Expansion Considerations

The architecture supports several expansion paths:

1. **Additional Authentication Methods**:
   - The auth system is abstracted to potentially support more providers

2. **Enhanced Analytics**:
   - The data model captures metrics that could be used for more advanced analytics

3. **Mobile Optimization**:
   - The UI is responsive and includes mobile detection hooks for future enhancements

4. **Internationalization**:
   - Structure in place to support multiple languages in the future