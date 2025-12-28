# Admin System & Password Reset

This document describes the admin system and password reset functionality implemented for Buck Euchre.

## Overview

The admin system allows designated administrators to:
- View all registered users
- Reset passwords for any user account
- Access an admin-only web interface

The system is designed to be extensible for future user-initiated password reset features.

## Architecture

### Backend Components

#### 1. Database Schema (`backend/prisma/schema.prisma`)
- Added `isAdmin` boolean field to User model (defaults to `false`)
- Migration created: `20251228_add_admin_field`

#### 2. Authentication Middleware (`backend/src/auth/middleware.ts`)
- Updated Request type to include `isAdmin` field
- Added `requireAdmin()` middleware function
- Checks both authentication and admin status

#### 3. Admin API Routes (`backend/src/api/admin.routes.ts`)
- **GET /api/admin/users** - List all users (admin only)
- **POST /api/admin/users/:userId/reset-password** - Reset user password (admin only)
- **GET /api/admin/check** - Check admin status

All endpoints require:
1. Valid authentication token (via `authenticateToken` middleware)
2. Admin privileges (via `requireAdmin` middleware)

#### 4. User Service Updates
- `validateSession()` now returns `isAdmin` field
- All auth endpoints return `isAdmin` in user data

### Frontend Components

#### 1. Auth Store (`frontend/src/stores/authStore.ts`)
- Added `isAdmin` field to state
- Persisted to localStorage
- Included in login response handling

#### 2. Admin Page (`frontend/src/pages/AdminPage.tsx`)
- User list with search/filter capabilities
- Password reset form
- Real-time validation
- Success/error messaging
- Guest user protection (cannot reset guest passwords)
- Future-compatible design for user-initiated resets

#### 3. Navigation Updates
- Admin panel link in header dropdown (purple, locked icon)
- Only visible to admin users
- Route protection (redirects non-admins)

## Usage

### 1. Promote a User to Admin

Run the provided script with a username:

```bash
cd backend
npx tsx scripts/make-admin.ts <username>
```

Example:
```bash
npx tsx scripts/make-admin.ts john
```

Output:
```
✅ Successfully promoted 'john' to admin
   User ID: abc-123-def
   Display Name: John Doe
```

### 2. Access the Admin Panel

1. Log in as an admin user
2. Click your profile in the header
3. Click "🔒 Admin Panel" in the dropdown
4. You'll be taken to `/admin`

### 3. Reset a User's Password

1. Navigate to the Admin Panel
2. Select a user from the list (guests cannot have passwords reset)
3. Enter a new password (minimum 6 characters)
4. Click "Reset Password"
5. The user can immediately log in with the new password

## Security Features

- **Authentication Required**: All admin endpoints require valid JWT token
- **Authorization Checks**: `requireAdmin` middleware prevents non-admin access
- **Password Hashing**: New passwords are hashed with bcrypt (10 salt rounds)
- **Guest Protection**: Cannot set passwords for guest users
- **Audit Logging**: Password resets are logged with admin username
- **Route Protection**: Frontend redirects non-admins away from admin pages

## API Reference

### List Users
```http
GET /api/admin/users
Authorization: Bearer <token>
```

Response:
```json
{
  "users": [
    {
      "id": "uuid",
      "username": "john",
      "displayName": "John Doe",
      "email": "john@example.com",
      "isGuest": false,
      "isAdmin": false,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastLoginAt": "2025-01-01T12:00:00.000Z"
    }
  ]
}
```

### Reset Password
```http
POST /api/admin/users/:userId/reset-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "newPassword": "newpass123"
}
```

Response:
```json
{
  "success": true,
  "message": "Password reset successfully for user 'john'",
  "user": {
    "id": "uuid",
    "username": "john",
    "displayName": "John Doe"
  }
}
```

Error Responses:
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Not an admin
- `404 Not Found` - User doesn't exist
- `400 Bad Request` - Guest user or invalid password

## Database Migration

To apply the migration:

```bash
cd backend
npx prisma migrate deploy
```

Or for development:
```bash
cd backend
npx prisma migrate dev
```

The migration adds the `isAdmin` column with a default value of `false` for all existing users.

## Future Enhancements

The system is designed to support future features:

### Planned Features:
1. **User-Initiated Password Reset**
   - Email-based reset tokens
   - Token expiration (1 hour)
   - Email verification requirement

2. **Email Verification**
   - Verify email addresses on signup
   - Require verified email for password reset

3. **Audit Logging**
   - Track all password changes
   - Log admin actions
   - Timestamp and IP address tracking

4. **Enhanced Admin Features**
   - Ban/suspend users
   - View user activity logs
   - Manage user roles

### Database Changes Needed:
```prisma
model PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
  used      Boolean  @default(false)
  user      User     @relation(...)
}

model AdminAuditLog {
  id        String   @id @default(uuid())
  adminId   String
  action    String
  targetId  String?
  details   Json?
  createdAt DateTime @default(now())
}
```

## Troubleshooting

### "Admin access required" error
- Ensure the user has been promoted to admin using the script
- Check that `isAdmin` is included in the JWT token
- Verify the user is logged in with fresh credentials

### Password reset fails
- Check password meets minimum requirements (6+ characters)
- Ensure target user is not a guest
- Verify admin has valid authentication token

### Admin panel not visible in navigation
- Log out and log back in (to refresh token with isAdmin field)
- Verify user's isAdmin field in database
- Clear browser localStorage and re-login

## Environment Variables

No new environment variables are required for the admin system. It uses the existing:

- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - Token signing
- `CORS_ORIGIN` - API access control

## Testing

Manual testing checklist:

- [ ] Promote user to admin using script
- [ ] Log in as admin user
- [ ] Access admin panel from header
- [ ] View user list
- [ ] Select a regular user
- [ ] Reset their password
- [ ] Log in as that user with new password
- [ ] Verify guest users cannot have passwords reset
- [ ] Verify non-admin users cannot access admin panel
- [ ] Verify non-admin users cannot call admin API endpoints

## Support

For issues or questions:
- Check the application logs (backend console)
- Review browser console for frontend errors
- Verify database schema is up to date
- Ensure all files are properly deployed
