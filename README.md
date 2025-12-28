# Buck Euchre

A real-time, multiplayer web implementation of Buck Euchre - a 4-player trick-taking card game with a unique countdown scoring system.

## Overview

Buck Euchre is a variation of the classic Euchre card game where four players compete individually (no partnerships). Players bid to win tricks, declare trump, and race from 15 points down to 0 or below to win. This implementation features real-time multiplayer gameplay, AI opponents with multiple difficulty levels, user accounts with statistics tracking, and a Progressive Web App (PWA) that works on desktop and mobile.

## Features

- **Real-time Multiplayer** - Play with friends using WebSocket connections
- **AI Opponents** - Three difficulty levels (Easy, Medium, Hard) with ISMCTS algorithm
- **User Accounts** - Track your game history and statistics
- **PWA Support** - Install on desktop or mobile devices
- **Responsive Design** - Works seamlessly on all screen sizes
- **Game State Persistence** - Resume games after disconnection
- **Spectator Mode** - Watch ongoing games
- **Comprehensive Statistics** - Track wins, losses, bids, and more

## Quick Start

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/yourusername/buckEuchre.git
cd buckEuchre

# Copy and configure environment file
cp .env.production.example .env.production
# Edit .env.production with your settings

# Start all services
./production-start.sh
```

The application will be available at `http://localhost` (or your configured domain).

### Manual Setup

**Prerequisites:**
- Node.js 20+ LTS
- PostgreSQL 16+
- npm

**1. Install dependencies:**

```bash
# Install shared package
cd shared && npm install && cd ..

# Install backend
cd backend && npm install && cd ..

# Install frontend
cd frontend && npm install && cd ..
```

**2. Configure environment:**

```bash
# Backend configuration
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Frontend configuration
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your API URLs
```

**3. Set up database:**

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
cd ..
```

**4. Build and run:**

```bash
# Build shared package
cd shared && npm run build && cd ..

# Build and start backend
cd backend && npm run build && npm start &

# Build and start frontend
cd frontend && npm run build && npm run preview
```

## Development

### Running Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Server runs on `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
App runs on `http://localhost:5173`

### Development with Docker

```bash
# Start PostgreSQL
./start-dev-services.sh

# Set up backend
cd backend
cp .env.example .env
npx prisma migrate dev
npm run dev
```

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** + **Shadcn/ui** for styling
- **Zustand** for state management
- **Socket.io Client** for real-time updates

### Backend
- **Node.js 20** with TypeScript
- **Express** for REST API
- **Socket.io** for WebSocket connections
- **Prisma ORM** with PostgreSQL 16
- **Zod** for runtime validation
- **JWT** for authentication

### Infrastructure
- **Docker** with Docker Compose
- **Nginx** as reverse proxy
- **PostgreSQL 16** for data persistence

## Architecture

This is a monorepo with three workspaces:

```
buckEuchre/
├── shared/          # Shared TypeScript types, validators, constants
├── backend/         # Node.js/Express server with Socket.io
├── frontend/        # React/Vite web application
├── nginx/           # Nginx configuration for production
└── docs/            # Additional documentation
```

Key architectural features:
- **Pure game logic** - All game rules implemented as pure functions with comprehensive tests
- **Type-safe** - End-to-end TypeScript with shared types across frontend/backend
- **Real-time sync** - WebSocket-based state synchronization
- **Resilient** - Automatic reconnection and state recovery

For detailed architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Game Rules

Buck Euchre is played with a 24-card deck (9-Ace in all suits). The game proceeds in rounds:

1. **Dealing** - 6 cards dealt to each player, 2-card kitty
2. **Bidding** - Players bid 2-6 tricks (or pass)
3. **Declaring Trump** - High bidder declares trump suit
4. **Stay or Fold** - Non-bidders decide to stay or fold
5. **Trick Taking** - Players play cards following suit
6. **Scoring** - Win your bid to score, lose to go "in the bucket"

The first player to reach 0 or below (starting from 15) wins!

For complete rules, see [BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md).

## Testing

```bash
# Backend unit tests
cd backend
npm test

# Backend test watch mode
npm run test:watch

# Frontend tests
cd frontend
npm test
```

For detailed testing procedures, see [TESTING_GUIDE.md](./TESTING_GUIDE.md).

## Documentation

### User Guides
- [BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md) - Complete game rules and scoring
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Comprehensive deployment guide
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures and strategies

### Technical Documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design decisions
- [API_SPEC.md](./API_SPEC.md) - REST and WebSocket API documentation
- [GAME_STATE_SPEC.md](./GAME_STATE_SPEC.md) - Game state structure and algorithms
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database design and schema
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - State management patterns
- [PWA-IMPLEMENTATION.md](./PWA-IMPLEMENTATION.md) - Progressive Web App setup
- [DEBUG_GUIDE.md](./DEBUG_GUIDE.md) - Debugging tips and common issues

### Backend Documentation
- [backend/DATABASE_SETUP.md](./backend/DATABASE_SETUP.md) - Database configuration
- [backend/src/ai/README.md](./backend/src/ai/README.md) - AI implementation details

## Deployment

### Production Deployment with Docker

1. **Configure environment:**
```bash
cp .env.production.example .env.production
# Edit with secure credentials and production URLs
```

2. **Deploy:**
```bash
./production-start.sh
```

3. **SSL/TLS (Recommended):**
Place SSL certificates in `nginx/ssl/` directory. See [DEPLOYMENT.md](./DEPLOYMENT.md) for details.

### Environment Variables

**Backend** (`.env`):
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT token signing
- `PORT` - Server port (default: 3000)
- `CORS_ORIGIN` - Allowed CORS origins

**Frontend** (`.env`):
- `VITE_API_URL` - Backend API URL
- `VITE_WS_URL` - WebSocket server URL

See `.env.example` files for complete configuration options.

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Code Style** - Follow existing TypeScript conventions
2. **Types** - Use explicit types, avoid `any`
3. **Tests** - Add tests for game logic and critical paths
4. **Documentation** - Update relevant docs for significant changes
5. **Commits** - Write clear, descriptive commit messages

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run tests (`npm test` in relevant workspace)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Built with modern web technologies and best practices
- AI algorithms based on Information Set Monte Carlo Tree Search (ISMCTS)
- UI components from [Shadcn/ui](https://ui.shadcn.com/)

---

**[Play Buck Euchre Now!](http://localhost:5173)** (after setup)
