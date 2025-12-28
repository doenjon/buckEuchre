/**
 * Script to promote a user to admin
 * Usage: npx tsx scripts/make-admin.ts <username>
 */

import { prisma } from '../src/db/client.js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function makeAdmin(username: string): Promise<void> {
  try {
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        isAdmin: true,
        isGuest: true,
      },
    });

    if (!user) {
      console.error(`❌ User '${username}' not found`);
      process.exit(1);
    }

    if (user.isGuest) {
      console.error(`❌ Cannot make guest user '${username}' an admin`);
      process.exit(1);
    }

    if (user.isAdmin) {
      console.log(`ℹ️  User '${username}' is already an admin`);
      process.exit(0);
    }

    // Update user to be admin
    await prisma.user.update({
      where: { id: user.id },
      data: { isAdmin: true },
    });

    console.log(`✅ Successfully promoted '${username}' to admin`);
    console.log(`   User ID: ${user.id}`);
    console.log(`   Display Name: ${user.displayName}`);
  } catch (error) {
    console.error('❌ Error promoting user to admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get username from command line arguments
const username = process.argv[2];

if (!username) {
  console.error('Usage: npx tsx scripts/make-admin.ts <username>');
  console.error('Example: npx tsx scripts/make-admin.ts john');
  process.exit(1);
}

makeAdmin(username);
