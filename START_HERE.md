# 🚀 START HERE

## For AI Agents Implementing This Project

### Step 1: Read the Roadmap
Open and read: **[AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md)**

This is your master guide. It contains 43 tasks broken into 7 phases with clear dependencies, testing requirements, and guidelines.

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

### Step 3: Start Implementation

Begin with **Task 0.1: Project Structure Setup** (no dependencies)

This task creates:
- Directory structure (shared/, backend/, frontend/)
- package.json files
- Basic TypeScript configuration
- Empty entry points

### Step 4: Update Progress

As you complete each task, update the roadmap with:
- **Status:** Change from ⬜ NOT_STARTED → 🟨 IN_PROGRESS → ✅ COMPLETE
- **Date completed:** YYYY-MM-DD format
- **Changes made:** List any deviations or improvements
- **Testing:** Confirm all checklist items passed

Also update [PROGRESS.md](./PROGRESS.md) with overall progress.

### Step 5: Follow Dependencies

**Important:** Each task lists dependencies. Don't start a task until its dependencies are complete.

Example flow:
- Task 0.1 (no deps) → Task 0.2 (depends on 0.1) → Task 0.3 (depends on 0.2)

### Guidelines

#### DO:
- ✅ Read specifications thoroughly before coding
- ✅ Follow TypeScript types exactly as defined
- ✅ Write pure functions for game logic (no side effects)
- ✅ Keep files small (<200 lines target)
- ✅ Test each task before marking complete
- ✅ Update roadmap after every task
- ✅ Document all design changes
- ✅ Commit frequently with clear messages

#### DON'T:
- ❌ Skip reading the design documents
- ❌ Change design docs without updating them
- ❌ Skip dependencies
- ❌ Mark tasks complete without testing
- ❌ Use `any` types in TypeScript
- ❌ Create files outside defined structure
- ❌ Add dependencies not in the plan without justification

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

# 2. Start Task 0.1
# Create directory structure, package.json files, etc.

# 3. Update roadmap status to IN_PROGRESS

# 4. Implement the task

# 5. Test everything in checklist

# 6. Update roadmap to COMPLETE

# 7. Commit
git add .
git commit -m "Complete Task 0.1: Project structure setup"

# 8. Move to Task 0.2
```

### Technology Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Shadcn/ui, Zustand
- **Backend:** Node.js 20+, Express, Socket.io, Prisma, TypeScript
- **Database:** PostgreSQL 16
- **Package Manager:** npm (not yarn or pnpm)

### Environment Setup

You'll need:
- Node.js 20+ LTS
- npm (comes with Node.js)
- PostgreSQL 16 (or Docker)

These will be set up as part of the implementation tasks.

---

## 🎯 Ready? 

**Start by reading [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) now!**

Then proceed to **Task 0.1: Project Structure Setup**

Good luck! 🎮

