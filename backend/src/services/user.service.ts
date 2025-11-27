/**
 * User service for managing user accounts and authentication
 */

import { User, Session } from '@prisma/client';
import bcrypt from 'bcrypt';
import { generateToken } from '../auth/jwt';
import { prisma } from '../db/client';

const SALT_ROUNDS = 10;
const SESSION_EXPIRY_HOURS = 24;

interface CreateUserParams {
  email?: string;
  username: string;
  password?: string;
  displayName: string;
  isGuest?: boolean;
}

interface AuthResponse {
  user: User;
  session: Session;
  token: string;
}

/**
 * Create a new user account with email/password
 */
export async function createUser(params: CreateUserParams): Promise<AuthResponse> {
  const { email, username, password, displayName, isGuest = false } = params;

  // Check if username is already taken
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    throw new Error('Username already taken');
  }

  // Check if email is already taken (if provided)
  if (email) {
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });

    if (existingEmail) {
      throw new Error('Email already registered');
    }
  }

  // Hash password if provided
  let passwordHash: string | null = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      email: email || null,
      username,
      passwordHash,
      displayName,
      isGuest,
      lastLoginAt: new Date(),
    },
  });

  // Create user stats
  await prisma.userStats.create({
    data: {
      userId: user.id,
    },
  });

  // Create user settings with defaults
  await prisma.userSettings.create({
    data: {
      userId: user.id,
      showCardOverlay: true,
      showTooltips: true,
      autoSortHand: true,
      bidSpeed: 'normal',
      animationSpeed: 'normal',
      soundEffects: true,
    },
  });

  // Create session
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  const token = generateToken(user.id, user.username, user.isGuest);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  return { user, session, token };
}

/**
 * Create a guest user account
 */
export async function createGuestUser(): Promise<AuthResponse> {
  const guestNumber = Math.floor(Math.random() * 10000);
  const username = `Guest${guestNumber}`;
  const displayName = `Guest ${guestNumber}`;

  return createUser({
    username,
    displayName,
    isGuest: true,
  });
}

/**
 * Authenticate user with email/username and password
 */
export async function authenticateUser(
  emailOrUsername: string,
  password: string
): Promise<AuthResponse> {
  // Find user by email or username
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrUsername },
        { username: emailOrUsername },
      ],
    },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  if (!user.passwordHash) {
    throw new Error('Invalid credentials');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new Error('Invalid credentials');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Create new session
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
  const token = generateToken(user.id, user.username, user.isGuest);

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  return { user, session, token };
}

/**
 * Validate session by token
 */
export async function validateSession(token: string): Promise<{ user: User; session: Session } | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    // Delete expired session
    await prisma.session.delete({
      where: { id: session.id },
    });
    return null;
  }

  // Update last active timestamp
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() },
  });

  return { user: session.user, session };
}

/**
 * Invalidate session (logout)
 */
export async function invalidateSession(token: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { token },
  });
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id: userId },
  });
}

/**
 * Get user with stats
 */
export async function getUserWithStats(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      stats: true,
    },
  });
}

/**
 * Search users by username (for friend search)
 */
export async function searchUsers(query: string, limit: number = 20): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      username: {
        contains: query,
        mode: 'insensitive',
      },
      isGuest: false, // Don't include guest users in search
    },
    take: limit,
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      createdAt: true,
      lastLoginAt: true,
      email: false, // Don't expose email
      passwordHash: false,
      oauthProvider: false,
      oauthId: false,
      emailVerified: false,
      isGuest: true,
    },
  }) as Promise<User[]>;
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}

