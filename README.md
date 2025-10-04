# Buck Euchre - Multiplayer Card Game

A real-time, multiplayer implementation of Buck Euchre, a 4-player trick-taking card game. Built with React, Node.js, and WebSockets.

## 🎮 About Buck Euchre

Buck Euchre is a variation of the classic Euchre card game played by 4 players individually (no partnerships). Players bid to win tricks, with a unique "countdown" scoring system where you race from 15 points to 0 or below to win.

For complete game rules, see [BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md).

## 📋 Project Status

**Current Phase:** Phase 5 - Frontend UI (MVP)  
**Status:** ✅ Phase 1 COMPLETE | ✅ Phase 2 COMPLETE | ✅ Phase 3 COMPLETE | ✅ Phase 4 COMPLETE  
**Next Task:** 5.1 - Vite + React Setup

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

- [START_HERE.md](./START_HERE.md) - Guide for AI agents implementing the project
- [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) - Complete task list and progress
- [BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md) - Complete game rules
- [GAME_STATE_SPEC.md](./GAME_STATE_SPEC.md) - Game state structure and algorithms
- [API_SPEC.md](./API_SPEC.md) - REST and WebSocket API documentation
- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database design and queries
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design decisions
- [STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md) - State management strategy
- [IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md) - Known shortcuts and technical debt

## 🎯 Development Roadmap

### Phase 1-5: MVP (Playable Game) - ~4 weeks
- ✅ Task 1.1: Project structure setup
- ⬜ Task 1.2-1.5: Foundation (types, constants, validators, database)
- ✅ Phase 2: Game logic (pure functions, fully tested)
- ✅ Phase 3: Backend services
- ⬜ Phase 4: REST & WebSocket API
- ⬜ Phase 5: Frontend UI components

### Phase 6-8: Production Polish - ~2 weeks
- ⬜ Error handling and reconnection
- ⬜ UI polish and full lobby
- ⬜ Comprehensive testing

### Phase 9: Deployment - ~1 week
- ⬜ Docker setup
- ⬜ Production configuration
- ⬜ Deployment guide

**Total:** 53 tasks across 9 phases

## 🎮 How to Play

Once the MVP is complete:

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
