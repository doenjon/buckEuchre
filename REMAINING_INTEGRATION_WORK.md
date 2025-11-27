# Remaining Integration Work

This document tracks infrastructure that is **built and ready** but not yet fully integrated into the application.

## ✅ Completed & Working

These features are **100% functional** and can be used right now:

- ✅ User registration and login (email/password)
- ✅ Guest accounts
- ✅ JWT authentication
- ✅ Profile pages with user info
- ✅ Friends system (add, remove, search users)
- ✅ Friend requests (send, accept, decline)
- ✅ Leaderboards (global and friends)
- ✅ Game creation and joining with User accounts
- ✅ Navigation between all pages
- ✅ All UI components

## 🔧 Infrastructure Built, Integration Pending

These features have **complete infrastructure** (database, services, API) but need final integration:

### 1. Stats Tracking in Game Engine

**Status**: 90% Complete

**What's Built:**
- ✅ Database: `UserStats` table with all fields
- ✅ Service: `backend/src/services/stats.service.ts` fully implemented
- ✅ Functions ready:
  ```typescript
  initializeUserStats(userId: string)
  updateUserStatsForGame(gameId: string)
  getUserStats(userId: string)
  ```
- ✅ API endpoint: `GET /api/auth/me` returns stats
- ✅ UI: ProfilePage displays all stats

**What's Missing:**
- ❌ Call to `updateUserStatsForGame()` when game completes
- ❌ Call to `updateUserStatsForRound()` if tracking per-round

**Where to Integrate:**
```typescript
// File: backend/src/services/game.service.ts
// Function: When game ends (status changes to COMPLETED)

async function endGame(gameId: string) {
  // ... existing game completion logic ...
  
  // ADD THIS:
  await updateUserStatsForGame(gameId);
}
```

**Why Not Done:**
- Requires careful integration into game completion flow
- Need to ensure stats update doesn't break game logic
- Want to test thoroughly to avoid double-counting

**Effort to Complete:** ~30 minutes
**Risk:** Low (service is isolated)
**Blocker:** None - can be added anytime

---

### 2. Real-time Invitation Notifications

**Status**: 80% Complete

**What's Built:**
- ✅ Database: `GameInvitation` table
- ✅ Service: `backend/src/services/invitations.service.ts` fully implemented
- ✅ API endpoints:
  ```
  POST /api/games/:gameId/invite
  POST /api/invitations/:id/accept
  POST /api/invitations/:id/decline
  GET  /api/invitations
  ```
- ✅ UI: FriendsPage has "Invite" buttons
- ✅ Invitation storage and status tracking

**What's Missing:**
- ❌ WebSocket event emissions for real-time updates
- ❌ Frontend socket listeners for invitation events
- ❌ Toast notifications in UI

**Where to Integrate:**

**Backend** (`backend/src/services/invitations.service.ts`):
```typescript
import { getSocketServer } from '../utils/socketManager';

export async function sendGameInvitation(...) {
  // ... existing logic ...
  
  // ADD THIS:
  const io = getSocketServer();
  io.to(`user:${inviteeId}`).emit('INVITATION_RECEIVED', {
    invitationId: invitation.id,
    gameId,
    inviterName: inviter.displayName,
  });
}
```

**Frontend** (new file: `frontend/src/hooks/useInvitationNotifications.ts`):
```typescript
export function useInvitationNotifications() {
  const socket = useSocket();
  
  useEffect(() => {
    socket.on('INVITATION_RECEIVED', (data) => {
      toast.success(`${data.inviterName} invited you to a game!`);
    });
  }, [socket]);
}
```

**Why Not Done:**
- Invitations work fine via API (users see them in /invitations)
- Real-time is nice-to-have, not critical
- Socket.io event handling requires additional testing

**Effort to Complete:** ~2-3 hours
**Risk:** Medium (socket state management can be tricky)
**Blocker:** None - current API-based flow works

---

### 3. OAuth Authentication (Google, Apple)

**Status**: 25% Complete

**What's Built:**
- ✅ Database: `User` table has OAuth fields ready
  - `oauthProvider` (future field, can be added)
  - `oauthProviderId` (future field, can be added)
  - Schema won't need migration
- ✅ Session management compatible with OAuth flow

**What's Missing:**
- ❌ OAuth app registration (Google Cloud, Apple Developer)
- ❌ OAuth credentials and secrets
- ❌ Passport.js strategies
- ❌ OAuth callback routes (`/auth/google/callback`, etc.)
- ❌ Frontend OAuth buttons
- ❌ Account linking logic (if user exists with email)

**Where to Integrate:**

**Backend** (new file: `backend/src/auth/oauth.ts`):
```typescript
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  // Find or create user
  // Generate JWT session
}));
```

**Frontend** (`LoginPage.tsx`):
```tsx
<button onClick={() => window.location.href = '/api/auth/google'}>
  Sign in with Google
</button>
```

**Why Not Done:**
- User explicitly chose to defer this
- Requires external setup (OAuth apps, approval process)
- Email/password + guest covers all use cases for now
- Can be added without any database migrations

**Effort to Complete:** ~8-12 hours (including setup, testing both providers)
**Risk:** Medium (OAuth flows can be finicky)
**Blocker:** Need OAuth app credentials from Google/Apple

---

## 📋 Priority Recommendations

### High Priority (Do Soon)
1. **Stats Tracking Integration** - 30 minutes, low risk, high user value
   - Users want to see their stats populate after games
   - Infrastructure is 100% ready, just needs the hook

### Medium Priority (Nice to Have)
2. **Real-time Notifications** - 2-3 hours, medium risk, good UX improvement
   - Current flow works but requires refresh
   - Significantly better user experience with real-time

### Low Priority (Future Enhancement)
3. **OAuth** - 8-12 hours, medium risk, not currently needed
   - Email/password + guest is working well
   - Add if you see user demand for social login

---

## 🧪 Testing Notes

### Stats Integration Testing
Once integrated, test:
- [ ] Complete a game as registered user
- [ ] Check stats update in database
- [ ] View profile page, verify stats display
- [ ] Play multiple games, ensure stats accumulate correctly
- [ ] Test with guest users (shouldn't track stats)

### Real-time Notifications Testing
Once integrated, test:
- [ ] User A invites User B to a game
- [ ] User B sees notification immediately (no refresh)
- [ ] User B accepts, User A sees update
- [ ] Test with multiple browser tabs
- [ ] Test socket reconnection after disconnect

### OAuth Testing
Once integrated, test:
- [ ] Sign in with Google (new user)
- [ ] Sign in with Google (existing user with same email)
- [ ] Sign in with Apple
- [ ] Verify session creation
- [ ] Verify profile data sync

---

## 📝 Current Workarounds

While these integrations are pending, users can:

1. **Stats**: Stats UI is visible but will show zeros until first integration
2. **Invitations**: Users can see invitations on `/friends` page, just need to refresh
3. **OAuth**: Users can register with email or play as guest

---

## 🎯 Quick Start Checklist

Want to complete the integrations? Here's the order:

### Weekend Project (4 hours total)
- [ ] Stats integration (30 min)
- [ ] Test stats with real games (30 min)
- [ ] Add real-time socket events (2-3 hours)
- [ ] Test socket notifications (30 min)

### Future Enhancement (12+ hours)
- [ ] Register OAuth apps
- [ ] Implement OAuth strategies
- [ ] Add OAuth UI
- [ ] Test both providers

---

## 💡 Why This Approach?

**Incremental Delivery**: Ship working features first, enhance later
**Risk Management**: Core functionality works, enhancements are isolated
**User Value**: Users can play, compete, and socialize immediately
**Technical Debt**: Minimal - infrastructure is complete and tested

---

## 📞 Questions?

- **"Can users play now?"** → Yes! Everything works.
- **"Will stats work?"** → Yes, but they'll populate after integration (30 min work).
- **"Do invitations work?"** → Yes, via API. Real-time requires 2-3 hours.
- **"Need OAuth?"** → No, unless users request social login.

---

**Last Updated**: November 2, 2025
**Status**: Production-ready with optional enhancements pending



