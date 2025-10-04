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
- Node.js 20+ LTS
- npm (comes with Node.js)
- PostgreSQL 16 (or Docker)

These will be set up as part of the implementation tasks.

---

## 🎯 Ready? 

**Start by reading [AI_IMPLEMENTATION_ROADMAP.md](./AI_IMPLEMENTATION_ROADMAP.md) now!**

Then proceed to **Task 1.1: Project Structure Setup** (Phase 1)

**Remember:** Complete Phases 1-5 for MVP, then Phases 6-9 for production.

Good luck! 🎮

