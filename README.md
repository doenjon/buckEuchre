# Buck Euchre - Multiplayer Card Game

A web application for playing Buck Euchre online with friends. Built to be AI-agent friendly for rapid development.

## 🚧 Project Status: DESIGN PHASE

This project is currently in the **design phase**. All specification documents are complete and ready for implementation.

**Design Documents:**
- ✅ [BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md) - Complete game rules
- ✅ [GAME_STATE_SPEC.md](./GAME_STATE_SPEC.md) - State structure and algorithms
- ✅ [API_SPEC.md](./API_SPEC.md) - REST and WebSocket API specification
- ✅ [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Database design with Prisma
- ✅ [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture and design principles
- ✅ [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) - **AI agent work breakdown and progress tracking**

**Next Steps:**
- See [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) for detailed task breakdown
- AI agents should start with Phase 0: Project Setup & Foundation
- Follow roadmap to track progress and coordinate work

## 🎯 MVP Goals

### Scope
- 4 human players (no AI opponents yet)
- Full Buck Euchre rules implementation
- Real-time multiplayer via WebSockets
- Simple name-based authentication (no passwords)
- Score tracking and game completion
- Player reconnection support
- Basic but polished UI

### Explicitly Out of Scope for MVP
- AI opponents
- User accounts / registration
- Game history / replays
- Chat system
- Mobile app (web-responsive only)
- Tournaments or leaderboards

## 🏗️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Shadcn/ui** for UI components
- **Zustand** for state management
- **Socket.io-client** for real-time communication

### Backend
- **Node.js 20+** with TypeScript
- **Express** for REST API
- **Socket.io** for WebSocket server
- **Prisma** ORM for database
- **Zod** for validation
- **JWT** for authentication

### Database
- **PostgreSQL 16**

### Deployment
- **Docker + Docker Compose**
- Target: AWS Lightsail / EC2 (~$5/month)

## 📋 Prerequisites

- **Node.js 20+** and npm
- **Docker & Docker Compose** (for deployment)
- **PostgreSQL 16** (or use Docker)

## 🚀 Quick Start (After Implementation)

### 1. Set Up Environment
```bash
cp .env.example .env
# Edit .env with your configuration
```

### 2. Development Mode

#### Option A: With Docker
```bash
docker-compose -f docker-compose.dev.yml up
```
- Frontend: http://localhost:5173
- Backend: http://localhost:3000
- PostgreSQL: localhost:5432

#### Option B: Local Development
```bash
# Terminal 1 - Database
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=buckeuchre \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=buckeuchre \
  postgres:16-alpine

# Terminal 2 - Backend
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev

# Terminal 3 - Frontend
cd frontend
npm install
npm run dev
```

### 3. Production Deployment
```bash
# Configure production .env first!
docker-compose up -d
```

Access at http://localhost (or your domain)

## 📁 Project Structure

```
buck-euchre/
├── shared/              # Shared TypeScript types and validators
│   ├── types/          # Game interfaces, API types
│   ├── validators/     # Zod schemas
│   └── constants/      # Game constants (deck, rules)
├── backend/            # Node.js server
│   ├── src/
│   │   ├── game/       # Pure game logic (no I/O)
│   │   ├── services/   # Business logic
│   │   ├── api/        # REST endpoints
│   │   ├── sockets/    # WebSocket handlers
│   │   └── db/         # Database client
│   └── prisma/         # Database schema and migrations
├── frontend/           # React application
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── hooks/      # Custom hooks
│   │   ├── stores/     # Zustand stores
│   │   └── services/   # API/Socket clients
├── nginx/              # Nginx config for production
└── docs/               # Design documents
```

## 🎮 Game Rules

Buck Euchre is a trick-taking card game for 4 players (playing individually, no teams).

**Quick Overview:**
- 24-card deck (9, 10, J, Q, K, A in all suits)
- Each player gets **5 cards**, 4 cards in the "blind" (kitty)
- Top card of blind is revealed
- Players bid (2-5) for how many tricks they'll take
- Winner declares trump suit
- Non-bidders can fold (unless Clubs turned up)
- **Start at 15 points**, race to **0 or below to win** (countdown scoring)
- Score decreases by tricks taken (good), increases by 5 if fail (bad)

**Full Rules:** See [BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md)

## 🏛️ Architecture Highlights

### Design Principles
1. **AI-Friendly**: Small, focused files (<200 lines), clear interfaces
2. **Type-Safe**: TypeScript everywhere, no `any` types
3. **Pure Game Logic**: All game rules as pure functions (easy to test)
4. **Server Authority**: Server validates all actions, client is view layer
5. **Real-Time**: WebSocket for instant game updates

### Key Patterns
- **Shared Types**: `shared/` directory imported by both frontend/backend
- **Pure Functions**: Game logic has no side effects
- **WebSocket Rooms**: Each game is a Socket.io room
- **State Management**: Zustand on client, in-memory Map on server
- **Database**: Prisma for type-safe queries and migrations

**Full Architecture:** See [ARCHITECTURE.md](./ARCHITECTURE.md)

## 🔌 API Overview

### REST Endpoints
- `POST /api/auth/join` - Create player session
- `POST /api/games` - Create new game
- `GET /api/games` - List available games
- `GET /api/games/:gameId` - Get game state

### WebSocket Events (Client → Server)
- `JOIN_GAME` - Join a game
- `PLACE_BID` - Place bid during bidding
- `DECLARE_TRUMP` - Declare trump suit
- `PLAY_CARD` - Play a card
- `START_NEXT_ROUND` - Start next round

### WebSocket Events (Server → Client)
- `GAME_STATE_UPDATE` - Game state changed
- `TRICK_COMPLETE` - Trick finished (for animation)
- `ROUND_COMPLETE` - Round finished with scores
- `ERROR` - Action was invalid

**Full API:** See [API_SPEC.md](./API_SPEC.md)

## 🗄️ Database

**Tables:**
- `Player` - Player sessions (ephemeral, 24h expiry)
- `Game` - Game records
- `GamePlayer` - Players in games (junction table)
- `GameState` - Persisted game state (JSON)
- `Round` - Round history (optional, for stats)

**Full Schema:** See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)

## 🧪 Testing (To Be Implemented)

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 🔒 Security

- Simple JWT authentication (name-only, no passwords)
- Server-side validation of all game actions
- Input validation with Zod schemas
- CORS configuration
- No sensitive data stored

## 📊 Cost Estimate

**MVP Deployment:**
- AWS Lightsail / DigitalOcean: $5-6/month
- Handles 10-20 concurrent users
- ~500MB storage

## 🤝 Contributing

This project is designed for AI-assisted development. Key resources:

1. Read design documents in `/docs`
2. Review TypeScript types in `shared/types/`
3. Follow established patterns in ARCHITECTURE.md
4. Keep files small and focused
5. Write pure functions for game logic

## 📝 Development Guidelines

### For AI Agents
- Each module has clear responsibilities
- Types defined in `shared/types/`
- Validators defined in `shared/validators/`
- Game logic is pure (in `backend/src/game/`)
- Comments explain "why", not "what"
- No file should exceed ~200 lines

### Code Style
- TypeScript strict mode enabled
- No `any` types
- Explicit function return types
- JSDoc comments for complex functions
- Meaningful variable names

## 🚢 Deployment Options

### Option 1: AWS Lightsail
```bash
# On Lightsail instance (Ubuntu)
sudo apt update
sudo apt install docker.io docker-compose -y
git clone <repo>
cd buck-euchre
cp .env.example .env
# Edit .env with production values
docker-compose up -d
```

### Option 2: Any VPS with Docker
Same steps as Lightsail.

### Option 3: Local Network
For truly small group (same network only):
```bash
docker-compose up -d
# Access at http://<your-local-ip>
```

## 📚 Documentation

- [Game Rules](./BUCK_EUCHRE_RULES.md) - How to play Buck Euchre
- [Game State Specification](./GAME_STATE_SPEC.md) - State structure, transitions, algorithms
- [API Specification](./API_SPEC.md) - REST + WebSocket API
- [Database Schema](./DATABASE_SCHEMA.md) - Database design
- [Architecture](./ARCHITECTURE.md) - System architecture and design decisions

## 🐛 Known Issues / Limitations

_To be documented during implementation_

## 🎯 Roadmap

### Phase 1: MVP (Current)
- [x] Complete design documents
- [ ] Project scaffolding
- [ ] Backend implementation
- [ ] Frontend implementation
- [ ] Testing and deployment

### Phase 2: Enhancements
- [ ] AI opponents (3 difficulty levels)
- [ ] Game replay system
- [ ] Player statistics
- [ ] Chat system

### Phase 3: Polish
- [ ] Mobile-optimized UI
- [ ] Animations and sound effects
- [ ] Tutorial for new players
- [ ] Spectator mode

## 📄 License

MIT

## 💬 Support

For questions or issues during development, refer to:
1. Design documents in this repository
2. TypeScript types and JSDoc comments
3. Open a GitHub issue

---

**Note:** This project prioritizes clarity and AI-friendliness over performance optimization. It's designed for small-scale use (friends and family) and as a demonstration of AI-assisted development.
