# PaveOS Backend

CRM and automation app backend for creators to manage brand deals, payments, and deliverables.

## Tech Stack

- **Framework**: Express.js + TypeScript
- **Database**: MongoDB + Mongoose
- **Authentication**: JWT + Whop OAuth + Google OAuth
- **Payments**: Stripe Integration
- **File Upload**: Multer
- **CSV Processing**: Papaparse
- **Scheduling**: Node-Cron

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or Atlas)
- npm >= 9.0.0

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your credentials
```

### Development

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Format code
npm run format
```

## Project Structure

```
src/
├── config/         # Configuration files (DB, constants)
├── models/         # Mongoose schemas
├── controllers/    # Request handlers
├── routes/         # API routes
├── middlewares/    # Custom middleware
├── services/       # External services (Stripe, Whop)
├── utils/          # Helper functions
├── types/          # TypeScript interfaces
└── server.ts       # Entry point
```

## API Documentation

Base URL: `http://localhost:5000/api/v1`

### Authentication Endpoints

- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/google` - Google OAuth login
- `POST /auth/whop` - Whop OAuth login
- `POST /auth/demo` - Demo account login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout user

### User Endpoints

- `GET /users/me` - Get current user
- `PUT /users/me` - Update current user
- `DELETE /users/me` - Delete account

### Contact Endpoints

- `GET /contacts` - List all contacts
- `POST /contacts` - Create contact
- `GET /contacts/:id` - Get contact by ID
- `PUT /contacts/:id` - Update contact
- `DELETE /contacts/:id` - Delete contact

### Deal Endpoints

- `GET /deals` - List all deals
- `POST /deals` - Create deal
- `GET /deals/:id` - Get deal by ID
- `PUT /deals/:id` - Update deal
- `DELETE /deals/:id` - Delete deal
- `PATCH /deals/:id/stage` - Update deal stage

### Payment Endpoints

- `GET /payments` - List payments
- `POST /payments/connect` - Connect Stripe
- `GET /payments/status` - Check Stripe connection
- `POST /payments/webhook` - Stripe webhook

### Dashboard Endpoints

- `GET /dashboard/stats` - Get dashboard statistics
- `GET /dashboard/recent-activity` - Get recent activities
- `GET /dashboard/revenue-chart` - Get revenue chart data

### Analytics Endpoints

- `GET /analytics/summary` - Get analytics summary
- `GET /analytics/revenue-trend` - Revenue over time
- `GET /analytics/conversion-funnel` - Conversion rates

### CSV Import Endpoints

- `POST /import/upload` - Upload CSV file
- `POST /import/preview` - Preview with auto-mapping
- `POST /import/confirm` - Confirm import
- `POST /import/undo` - Undo last import
- `GET /import/history` - Import history

### Telemetry Endpoints

- `POST /telemetry/track` - Track event
- `GET /telemetry/events` - Get user events

## Environment Variables

See `.env.example` for all required environment variables.

## License

MIT
