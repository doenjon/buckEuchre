/**
 * Game invitations service
 */

import { GameInvitation, InvitationStatus } from '@prisma/client';
import { prisma } from '../db/client';
import { areFriends } from './friends.service';

const INVITATION_EXPIRY_HOURS = 24;

/**
 * Send a game invitation
 */
export async function sendInvitation(
  gameId: string,
  inviterId: string,
  inviteeId: string
): Promise<GameInvitation> {
  // Can't invite yourself
  if (inviterId === inviteeId) {
    throw new Error('Cannot invite yourself');
  }

  // Check if game exists and is joinable
  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: {
      players: true,
    },
  });

  if (!game) {
    throw new Error('Game not found');
  }

  if (game.status !== 'WAITING') {
    throw new Error('Game is not accepting players');
  }

  if (game.players.length >= 4) {
    throw new Error('Game is full');
  }

  // Check if invitee exists
  const invitee = await prisma.user.findUnique({
    where: { id: inviteeId },
  });

  if (!invitee) {
    throw new Error('User not found');
  }

  // Check if they're friends (optional - you may want to allow inviting anyone)
  const isFriend = await areFriends(inviterId, inviteeId);
  if (!isFriend) {
    throw new Error('Can only invite friends');
  }

  // Check if invitation already exists
  const existing = await prisma.gameInvitation.findUnique({
    where: {
      gameId_inviteeId: {
        gameId,
        inviteeId,
      },
    },
  });

  if (existing && existing.status === 'PENDING') {
    throw new Error('Invitation already sent');
  }

  // Delete old declined/expired invitations
  if (existing) {
    await prisma.gameInvitation.delete({
      where: { id: existing.id },
    });
  }

  // Create invitation
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);

  return prisma.gameInvitation.create({
    data: {
      gameId,
      inviterId,
      inviteeId,
      status: 'PENDING',
      expiresAt,
    },
    include: {
      game: true,
      inviter: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      invitee: {
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
 * Accept a game invitation
 */
export async function acceptInvitation(invitationId: string, userId: string): Promise<GameInvitation> {
  const invitation = await prisma.gameInvitation.findUnique({
    where: { id: invitationId },
    include: {
      game: {
        include: {
          players: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Only the invitee can accept
  if (invitation.inviteeId !== userId) {
    throw new Error('Unauthorized');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Invitation is not pending');
  }

  // Check if expired
  if (invitation.expiresAt < new Date()) {
    await prisma.gameInvitation.update({
      where: { id: invitationId },
      data: { status: 'EXPIRED' },
    });
    throw new Error('Invitation has expired');
  }

  // Check if game is still joinable
  if (invitation.game.status !== 'WAITING') {
    throw new Error('Game is no longer accepting players');
  }

  if (invitation.game.players.length >= 4) {
    throw new Error('Game is full');
  }

  // Mark invitation as accepted
  const updated = await prisma.gameInvitation.update({
    where: { id: invitationId },
    data: { status: 'ACCEPTED' },
    include: {
      game: true,
      inviter: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      invitee: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  return updated;
}

/**
 * Decline a game invitation
 */
export async function declineInvitation(invitationId: string, userId: string): Promise<void> {
  const invitation = await prisma.gameInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  // Only the invitee can decline
  if (invitation.inviteeId !== userId) {
    throw new Error('Unauthorized');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Invitation is not pending');
  }

  await prisma.gameInvitation.update({
    where: { id: invitationId },
    data: { status: 'DECLINED' },
  });
}

/**
 * Get pending invitations for a user
 */
export async function getInvitations(userId: string) {
  return prisma.gameInvitation.findMany({
    where: {
      inviteeId: userId,
      status: 'PENDING',
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      game: {
        include: {
          players: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  displayName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      },
      inviter: {
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
 * Get invitations sent by a user for a specific game
 */
export async function getGameInvitations(gameId: string, inviterId: string) {
  return prisma.gameInvitation.findMany({
    where: {
      gameId,
      inviterId,
    },
    include: {
      invitee: {
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
 * Expire old invitations (cleanup job)
 */
export async function expireOldInvitations(): Promise<number> {
  const result = await prisma.gameInvitation.updateMany({
    where: {
      status: 'PENDING',
      expiresAt: {
        lt: new Date(),
      },
    },
    data: {
      status: 'EXPIRED',
    },
  });

  return result.count;
}

/**
 * Cancel an invitation (by inviter only)
 */
export async function cancelInvitation(invitationId: string, inviterId: string): Promise<void> {
  const invitation = await prisma.gameInvitation.findUnique({
    where: { id: invitationId },
  });

  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.inviterId !== inviterId) {
    throw new Error('Unauthorized');
  }

  if (invitation.status !== 'PENDING') {
    throw new Error('Invitation is not pending');
  }

  await prisma.gameInvitation.delete({
    where: { id: invitationId },
  });
}



