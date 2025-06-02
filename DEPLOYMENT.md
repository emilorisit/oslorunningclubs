# Deployment Guide

## Environment Variables Required

Create a `.env` file in the root directory with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# Strava API Configuration
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret

# Session Configuration
SESSION_SECRET=your_secure_session_secret

# Application Configuration
NODE_ENV=production
PORT=5000
```

## Production Deployment Steps

### 1. Database Setup
```bash
# Install PostgreSQL and create database
createdb oslo_running_calendar

# Run database migrations
npm run db:push
```

### 2. Application Setup
```bash
# Install dependencies
npm install

# Build application
npm run build

# Start production server
npm start
```

### 3. Process Management (PM2)
```bash
# Install PM2 globally
npm install -g pm2

# Start application with PM2
pm2 start server/index.ts --name oslo-running-calendar

# Save PM2 configuration
pm2 save
pm2 startup
```

### 4. Nginx Configuration
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 5000

CMD ["npm", "start"]
```

## Health Checks

The application includes built-in health check endpoints:
- `GET /health` - Basic health check
- `GET /api/health` - API health check with database connectivity

## Monitoring

Consider implementing:
- Application performance monitoring (APM)
- Log aggregation (ELK stack or similar)
- Database monitoring
- Uptime monitoring