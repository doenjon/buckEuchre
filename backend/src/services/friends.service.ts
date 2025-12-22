/**
 * Friends service for managing friendships
 */

import { Friendship, FriendshipStatus } from '@prisma/client';
import { prisma } from '../db/client';

/**
 * Send a friend request
 */
export async function sendFriendRequest(requesterId: string, receiverId: string): Promise<Friendship> {
  // Can't friend yourself
  if (requesterId === receiverId) {
    throw new Error('Cannot send friend request to yourself');
  }

  // Check if receiver exists and is not a guest
  const receiver = await prisma.user.findUnique({
    where: { id: receiverId },
  });

  if (!receiver) {
    throw new Error('User not found');
  }

  if (receiver.isGuest) {
    throw new Error('Cannot send friend request to guest users');
  }

  // Check if friendship already exists
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId, receiverId },
        { requesterId: receiverId, receiverId: requesterId },
      ],
    },
  });

  if (existing) {
    if (existing.status === 'PENDING') {
      throw new Error('Friend request already sent');
    } else if (existing.status === 'ACCEPTED') {
      throw new Error('Already friends');
    } else if (existing.status === 'BLOCKED') {
      throw new Error('Cannot send friend request');
    }
  }

  // Create friend request
  return prisma.friendship.create({
    data: {
      requesterId,
      receiverId,
      status: 'PENDING',
    },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      receiver: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

/**
 * Accept a friend request
 */
export async function acceptFriendRequest(friendshipId: string, userId: string): Promise<Friendship> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  // Only the receiver can accept
  if (friendship.receiverId !== userId) {
    throw new Error('Unauthorized');
  }

  if (friendship.status !== 'PENDING') {
    throw new Error('Friend request is not pending');
  }

  return prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: 'ACCEPTED' },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      receiver: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });
}

/**
 * Decline a friend request
 */
export async function declineFriendRequest(friendshipId: string, userId: string): Promise<void> {
  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    throw new Error('Friend request not found');
  }

  // Only the receiver can decline
  if (friendship.receiverId !== userId) {
    throw new Error('Unauthorized');
  }

  if (friendship.status !== 'PENDING') {
    throw new Error('Friend request is not pending');
  }

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: 'DECLINED' },
  });
}

/**
 * Get all friends (accepted friendships)
 */
export async function getFriends(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, status: 'ACCEPTED' },
        { receiverId: userId, status: 'ACCEPTED' },
      ],
    },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          lastLoginAt: true,
        },
      },
      receiver: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          lastLoginAt: true,
        },
      },
    },
  });

  // Return the friend (not the current user)
  return friendships.map(f => ({
    friendshipId: f.id,
    friend: f.requesterId === userId ? f.receiver : f.requester,
    since: f.createdAt,
  }));
}

/**
 * Get pending friend requests (received)
 */
export async function getPendingRequests(userId: string) {
  return prisma.friendship.findMany({
    where: {
      receiverId: userId,
      status: 'PENDING',
    },
    include: {
      requester: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Get sent friend requests (pending)
 */
export async function getSentRequests(userId: string) {
  return prisma.friendship.findMany({
    where: {
      requesterId: userId,
      status: 'PENDING',
    },
    include: {
      receiver: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Remove a friend (delete friendship)
 */
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  // Find the friendship
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, receiverId: friendId, status: 'ACCEPTED' },
        { requesterId: friendId, receiverId: userId, status: 'ACCEPTED' },
      ],
    },
  });

  if (!friendship) {
    throw new Error('Friendship not found');
  }

  await prisma.friendship.delete({
    where: { id: friendship.id },
  });
}

/**
 * Block a user
 */
export async function blockUser(userId: string, blockedUserId: string): Promise<void> {
  if (userId === blockedUserId) {
    throw new Error('Cannot block yourself');
  }

  // Find existing friendship or create new one as blocked
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, receiverId: blockedUserId },
        { requesterId: blockedUserId, receiverId: userId },
      ],
    },
  });

  if (existing) {
    await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: 'BLOCKED' },
    });
  } else {
    await prisma.friendship.create({
      data: {
        requesterId: userId,
        receiverId: blockedUserId,
        status: 'BLOCKED',
      },
    });
  }
}

/**
 * Check if two users are friends
 */
export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const friendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId1, receiverId: userId2, status: 'ACCEPTED' },
        { requesterId: userId2, receiverId: userId1, status: 'ACCEPTED' },
      ],
    },
  });

  return !!friendship;
}



