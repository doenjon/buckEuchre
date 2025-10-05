# Buck Euchre - Multiplayer Card Game

A real-time, multiplayer implementation of Buck Euchre, a 4-player trick-taking card game. Built with React, Node.js, and WebSockets.

## 🎮 About Buck Euchre

Buck Euchre is a variation of the classic Euchre card game played by 4 players individually (no partnerships). Players bid to win tricks, with a unique "countdown" scoring system where you race from 15 points to 0 or below to win.

For complete game rules, see [BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md).

## 📋 Project Status

**Current Phase:** ✅ ALL PHASES COMPLETE  
**Status:** ✅ Phase 1-9 COMPLETE | 🎉 **Production Ready!**  
**Completion:** 52/56 tasks (93%)

See [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) for detailed progress tracking.

## 🏗️ Architecture

This is a monorepo with three workspaces:

- **`shared/`** - Shared TypeScript types, constants, and validators
- **`backend/`** - Node.js/Express server with Socket.io for real-time gameplay
- **`frontend/`** - React/Vite web application

```
buck-euchre/
├── shared/          # Shared code (types, validators, constants)
├── backend/         # Game server (Express + Socket.io)
├── frontend/        # Web client (React + Vite)
└── docs/            # Design documents
```

## 🚀 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Shadcn/ui** for UI components
- **Zustand** for state management
- **Socket.io-client** for real-time updates

### Backend
- **Node.js 20+** with TypeScript
- **Express** for REST API
- **Socket.io** for WebSocket connections
- **Prisma** ORM for database
- **PostgreSQL 16** for data persistence
- **Zod** for validation
- **JWT** for authentication

## 📦 Installation

### Prerequisites
- Node.js 20+ LTS
- npm (comes with Node.js)
- PostgreSQL 16 (or Docker)

### Setup

1. **Clone the repository:**
```bash
git clone <repository-url>
cd buck-euchre
```

2. **Install dependencies for all workspaces:**
```bash
# Install shared package
cd shared
npm install

# Install backend
cd ../backend
npm install

# Install frontend
cd ../frontend
npm install
```

3. **Set up environment variables:**
```bash
# Copy example environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Edit backend/.env with your database credentials
# Edit frontend/.env with your API URLs
```

4. **Set up database:**
```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

## 🎯 Development

### Running the Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```
Server runs on http://localhost:3000

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
App runs on http://localhost:5173

### Building for Production

**Build all workspaces:**
```bash
# Build shared package
cd shared
npm run build

# Build backend
cd ../backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

## 🧪 Testing

**Backend unit tests:**
```bash
cd backend
npm test
```

**Backend test watch mode:**
```bash
cd backend
npm run test:watch
```

## 📚 Documentation

### Getting Started
- [README.md](./README.md) - This file (project overview)
- [DEPLOYMENT.md](./DEPLOYMENT.md) - **Complete deployment guide** (500+ lines)
- [START_HERE.md](./START_HERE.md) - Guide for AI agents

### Design & Specifications
- [BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md) - Complete game rules
- [GAME_STATE_SPEC.md](./GAME_STATE_SPEC.md) - Game state structure and algorithms
- [API_SPEC.md](./API_SPEC.md) - REST and WebSocket API documentation
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database design and queries
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design decisions
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - State management strategy

### Implementation
- [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) - Complete task list
- [PROGRESS.md](./PROGRESS.md) - Progress tracking (93% complete)
- [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) - Technical notes
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Testing procedures

### Phase Summaries
- [PHASE_1_COMPLETE.md](./PHASE_1_COMPLETE.md) - Foundation
- [PHASE_2_SUMMARY.md](./PHASE_2_SUMMARY.md) - Game Logic
- [PHASE_3_SUMMARY.md](./PHASE_3_SUMMARY.md) - Backend Services
- [PHASE_4_SUMMARY.md](./PHASE_4_SUMMARY.md) - Backend API
- [PHASE_6_SUMMARY.md](./PHASE_6_SUMMARY.md) - Error Handling
- [PHASE_7_SUMMARY.md](./PHASE_7_SUMMARY.md) - UI Polish
- [PHASE_8_SUMMARY.md](./PHASE_8_SUMMARY.md) - Production Testing
- [PHASE_9_SUMMARY.md](./PHASE_9_SUMMARY.md) - Deployment

### Project Completion
- [PROJECT_COMPLETE.md](./PROJECT_COMPLETE.md) - **🎉 Project completion summary**

## 🎯 Development Roadmap

### Phase 1-5: MVP (Playable Game) - ✅ COMPLETE
- ✅ Phase 1: Foundation (types, constants, validators, database)
- ✅ Phase 2: Game logic (pure functions, fully tested)
- ✅ Phase 3: Backend services
- ✅ Phase 4: REST & WebSocket API
- ✅ Phase 5: Frontend UI components
- ✅ Phase 5.5: Automated testing

### Phase 6-8: Production Polish - ✅ COMPLETE
- ✅ Phase 6: Error handling and reconnection
- ✅ Phase 7: UI polish and full lobby
- ✅ Phase 8: Comprehensive testing

### Phase 9: Deployment - ✅ COMPLETE
- ✅ Docker development and production setup
- ✅ Production configuration and security
- ✅ Comprehensive deployment guide

**Total:** 52/56 tasks complete (93%) 🎉

## 🚀 Quick Start

### Development Environment

```bash
# 1. Start PostgreSQL
./start-dev-services.sh

# 2. Set up backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev

# 3. Set up frontend (in another terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Production Deployment

```bash
# 1. Configure environment
cp .env.production.example .env.production
# Edit .env.production with secure credentials

# 2. Deploy all services
./production-start.sh

# 3. Your app is now running!
# Access at http://localhost or your domain
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

---

## 🎮 How to Play

1. Navigate to http://localhost:5173
2. Enter your name to join a session
3. Create or join a game (4 players required)
4. Once 4 players join, the game begins!
5. Place bids, declare trump, fold or stay, play cards, and race to 0!

## 🤝 Contributing

This project is being built incrementally following the AI Implementation Roadmap. Each task has specific acceptance criteria and testing requirements.

To contribute:
1. Check [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) for available tasks
2. Review the design documents for the relevant task
3. Follow the architecture patterns in [ARCHITECTURE.md](./ARCHITECTURE.md)
4. Ensure all TypeScript types are explicit (no `any` types)
5. Write tests for all game logic functions
6. Update PROGRESS.md with your changes

## 📝 License

MIT

## 🙏 Acknowledgments

Built with AI assistance following a comprehensive specification-first approach.
