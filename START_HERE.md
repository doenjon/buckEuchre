# 🚀 START HERE

## For AI Agents Implementing This Project

### Step 1: Read the Roadmap
Open and read: **[AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md)**

This is your master guide. It contains **53 tasks in 9 phases**, structured for **incremental delivery**:
- **Phases 1-5**: Playable MVP (~4 weeks, 36 tasks)
- **Phases 6-8**: Production polish (~2 weeks, 13 tasks)  
- **Phase 9**: Deployment infrastructure (~1 week, 4 tasks)

### Step 2: Read Design Documents (in order)

1. **[BUCK_EUCHRE_RULES.md](./BUCK_EUCHRE_RULES.md)** - Complete game rules
   - Understand the card game mechanics
   - 5 cards per player, 4-card blind, folding, countdown scoring
   
2. **[GAME_STATE_SPEC.md](./GAME_STATE_SPEC.md)** - State structure and algorithms
   - GameState interface (the core data structure)
   - State machine with all phases
   - Algorithms for trick evaluation and scoring
   
3. **[API_SPEC.md](./API_SPEC.md)** - API contracts
   - REST endpoints
   - WebSocket events
   - Request/response types
   
4. **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** - Database design
   - Prisma schema (copy-paste ready)
   - Queries and relationships
   
5. **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture
   - Directory structure
   - Technology stack
   - Design patterns
   
6. **[STATE_MANAGEMENT.md](./STATE_MANAGEMENT.md)** - State mutation strategy
   - Action queue pattern
   - Race condition prevention
   - Concurrency handling

### Step 3: Start Implementation

Begin with **Task 1.1: Project Structure Setup** (Phase 1, no dependencies)

This task creates:
- Directory structure (shared/, backend/, frontend/)
- package.json files
- Basic TypeScript configuration
- Empty entry points

### Step 4: Track Progress

As you work:
- Update task status: ⬜ NOT_STARTED → 🟨 IN_PROGRESS → ✅ COMPLETE
- Complete all testing checklist items
- Document any changes made
- Update [PROGRESS.md](./PROGRESS.md)

### Step 5: MVP Milestone

After completing **Phase 5**, you'll have a **playable MVP**:
- 4 players can join and play
- All rules implemented
- Basic UI functional
- Real-time updates working

**Then proceed to Phases 6-9 for production polish and deployment.**

### Step 6: Follow Dependencies

Each task lists dependencies. Don't start a task until its dependencies are complete.

Example flow:
- Task 1.1 (no deps) → Task 1.2 (depends on 1.1) → Task 1.3 (depends on 1.2)

### Guidelines

**DO:**
- ✅ Read specifications before coding
- ✅ Follow TypeScript types exactly
- ✅ Write pure functions for game logic
- ✅ Keep files small (<200 lines)
- ✅ Test before marking complete
- ✅ Update roadmap and PROGRESS.md
- ✅ Commit frequently
- ✅ Check IMPLEMENTATION_NOTES.md for known shortcuts

**DON'T:**
- ❌ Skip dependencies
- ❌ Use `any` types in TypeScript
- ❌ Mark tasks complete without testing
- ❌ Create files outside defined structure
- ❌ "Improve" intentional shortcuts (check IMPLEMENTATION_NOTES.md first)

**IMPORTANT:** This project takes deliberate shortcuts for MVP speed. See IMPLEMENTATION_NOTES.md "Known Shortcuts & Technical Debt" section. If something looks suboptimal, it might be intentional!

### Key Principles

1. **Design Documents are the Contract** - Follow them exactly
2. **Type Safety Everywhere** - No `any` types, explicit return types
3. **Pure Game Logic** - Functions in `backend/src/game/` must be pure (no I/O)
4. **Shared Types** - Use `shared/types/` for types used by both frontend and backend
5. **Server is Authority** - All game logic runs on server, client validates for UX only
6. **Small Files** - Split files if they exceed ~200 lines

### Testing Requirements

Each task has a testing checklist. Examples:
- Unit tests for pure functions
- Integration tests for API endpoints
- Manual testing for UI components
- All tests must pass before marking complete

### Need Help?

1. Check the **AI_IMPLEMENTATION_ROADMAP.md** "Guidelines for AI Agents" section
2. Review the specific design document referenced in your task
3. Look at the "Can Change" vs "Cannot Change" sections in each task

### Progress Tracking Format

When you start a task:
```markdown
Status: 🟨 IN_PROGRESS
Assigned to: [Your Agent ID]
Started: 2025-01-05
Progress: [What you're working on]
Blockers: [Any issues or None]
```

When you complete a task:
```markdown
Status: ✅ COMPLETE
Completed: 2025-01-05
Changes Made:
- [List any additions or modifications]
Testing: All tests passing (see [path to tests])
```

### Example First Steps

```bash
# 1. Read the roadmap
cat AI_IMPLEMENTATION_ROADMAP.md

# 2. Start Task 1.1
# Create directory structure, package.json files, etc.

# 3. Update status to IN_PROGRESS

# 4. Implement the task

# 5. Complete testing checklist

# 6. Update status to COMPLETE

# 7. Commit
git add .
git commit -m "Complete Task 1.1: Project structure setup"

# 8. Move to Task 1.2
```

### Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui, Zustand
- **Backend:** Node.js 20+, Express, Socket.io, Prisma, TypeScript
- **Database:** PostgreSQL 16
- **Package Manager:** npm (not yarn or pnpm)

### Environment Setup

You'll need:
- Node.js 20+ LTS (Node 20+ required, tested with v22.13.0)
- npm (comes with Node.js)
- PostgreSQL 16 (or Docker)
- Docker and Docker Compose (for local development)

## 🚀 Local Development Setup

### Quick Start: Running the Application

The application uses **Docker Compose** for local development. This provides:
- Hot reload for both frontend and backend
- Consistent environment across machines
- Easy database management
- All services orchestrated together

#### Option 1: Docker Compose (Recommended)

**Start all services:**
```bash
# Start database, backend, frontend, and nginx
docker compose up -d

# View logs (follow)
docker compose logs -f

# View specific service logs
docker compose logs -f frontend
docker compose logs -f backend

# Stop all services
docker compose down

# Restart a specific service (after code changes)
docker compose restart frontend
docker compose restart backend
```

**Access the application:**
- **Frontend**: http://localhost:5173 (Vite dev server) or http://localhost (via Nginx)
- **Backend API**: http://localhost:3000
- **PostgreSQL**: localhost:5432

**Check service status:**
```bash
docker compose ps
```

#### Option 2: Manual Development (Node.js Required)

If you prefer to run services manually (outside Docker):

**1. Set up Node.js Environment**

On macOS with Homebrew-installed Node.js:
```bash
# Use the correct Node.js version
export PATH="/Users/Jon/miniforge3/bin:$PATH"

# Verify Node.js version (should be 20+)
node --version  # Should show v22.13.0 or similar
npm --version
```

**2. Start Database (Docker)**
```bash
# Just start the database
docker compose -f docker-compose.dev.yml up -d postgres
```

**3. Start Backend**
```bash
# Set Node.js path (if not in your shell profile)
export PATH="/Users/Jon/miniforge3/bin:$PATH"

cd backend
npm install
npx prisma migrate deploy  # Run migrations
npm run dev                # Start dev server (port 3000)
```

**4. Start Frontend**
```bash
# Set Node.js path (if not in your shell profile)
export PATH="/Users/Jon/miniforge3/bin:$PATH"

cd frontend
npm install
npm run dev                # Start Vite dev server (port 5173)
```

**5. Optional: Start Nginx** (if you want routing via port 80)
```bash
# Add nginx to docker-compose.dev.yml or run separately
```

### Node.js Version Management

**Important**: This project requires **Node.js 20+**. If you have multiple Node.js installations:

**Find your Node.js installations:**
```bash
# Check which node is in PATH
which node
node --version

# If you see an old version (e.g., v6.9.4), find Homebrew Node.js:
brew list node@20 2>/dev/null || brew list node

# On macOS with Homebrew, Node.js is typically at:
# /opt/homebrew/bin/node (Apple Silicon)
# /usr/local/bin/node (Intel)
# Or in your case: /Users/Jon/miniforge3/bin/node
```

**Set Node.js path for current session:**
```bash
export PATH="/Users/Jon/miniforge3/bin:$PATH"
```

**Set Node.js path permanently** (add to `~/.zshrc` or `~/.bash_profile`):
```bash
echo 'export PATH="/Users/Jon/miniforge3/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Environment Variables

Create `.env` files for configuration:

**Backend `.env`:**
```bash
DATABASE_URL="postgresql://buckeuchre:password@localhost:5432/buckeuchre"
JWT_SECRET="your-secure-random-secret-here"
JWT_EXPIRES_IN="24h"
CORS_ORIGIN="http://localhost:5173"
WS_URL="http://localhost:3000"
PORT=3000
NODE_ENV=development
```

**Frontend `.env`:**
```bash
VITE_API_URL="http://localhost:3000"
VITE_WS_URL="ws://localhost:3000"
```

### Database Setup

**First time setup:**
```bash
# Start PostgreSQL (via Docker)
docker compose -f docker-compose.dev.yml up -d postgres

# Run migrations
cd backend
npx prisma migrate deploy

# Or reset database (destructive - removes all data)
npx prisma migrate reset --force
```

**View database:**
```bash
# Using Prisma Studio (GUI)
cd backend
npx prisma studio

# Opens at http://localhost:5555
```

### Common Development Commands

**Backend:**
```bash
cd backend

# Install dependencies
npm install

# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

**Shared Package:**
```bash
cd shared

# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode (auto-rebuild)
npm run watch
```

### Troubleshooting

**"docker-compose: command not found"**
- Install Docker Desktop: https://www.docker.com/products/docker-desktop
- Or use `docker compose` (newer syntax, no hyphen)

**"Node version mismatch" or old Node.js version**
```bash
# Use the correct Node.js path
export PATH="/Users/Jon/miniforge3/bin:$PATH"
node --version  # Verify it's 20+
```

**"Port already in use"**
```bash
# Find what's using the port
lsof -i :3000  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # PostgreSQL

# Kill the process or change ports in config
```

**"Database connection failed"**
```bash
# Check PostgreSQL is running
docker compose ps

# Check connection string in .env
# Verify DATABASE_URL matches docker-compose settings
```

**"Hot reload not working"**
- Ensure volumes are mounted correctly in docker-compose.override.yml
- Check file permissions
- Restart the service: `docker compose restart frontend`

### Recommended Development Workflow

1. **Start everything:**
   ```bash
   docker compose up -d
   ```

2. **Watch logs:**
   ```bash
   docker compose logs -f
   ```

3. **Make code changes** → Services auto-reload

4. **View application:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000

5. **Stop everything:**
   ```bash
   docker compose down
   ```

These will be set up as part of the implementation tasks.

---

## 🎯 Ready? 

**Start by reading [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) now!**

Then proceed to **Task 1.1: Project Structure Setup** (Phase 1)

**Remember:** Complete Phases 1-5 for MVP, then Phases 6-9 for production.

Good luck! 🎮

