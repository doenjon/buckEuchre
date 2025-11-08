-- CreateEnum
CREATE TYPE "ArenaMatchStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ERROR');

-- CreateTable
CREATE TABLE "ArenaConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "paramsJson" JSONB,
    "eloRating" DOUBLE PRECISION NOT NULL DEFAULT 1500.0,
    "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArenaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaMatch" (
    "id" TEXT NOT NULL,
    "status" "ArenaMatchStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ArenaMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArenaParticipant" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "finalScore" INTEGER NOT NULL,
    "eloRatingBefore" DOUBLE PRECISION NOT NULL,
    "eloRatingAfter" DOUBLE PRECISION NOT NULL,
    "eloChange" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ArenaParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArenaConfig_eloRating_idx" ON "ArenaConfig"("eloRating");

-- CreateIndex
CREATE INDEX "ArenaConfig_gamesPlayed_idx" ON "ArenaConfig"("gamesPlayed");

-- CreateIndex
CREATE INDEX "ArenaMatch_status_createdAt_idx" ON "ArenaMatch"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ArenaParticipant_matchId_idx" ON "ArenaParticipant"("matchId");

-- CreateIndex
CREATE INDEX "ArenaParticipant_configId_idx" ON "ArenaParticipant"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "ArenaParticipant_matchId_position_key" ON "ArenaParticipant"("matchId", "position");

-- AddForeignKey
ALTER TABLE "ArenaParticipant" ADD CONSTRAINT "ArenaParticipant_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "ArenaMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArenaParticipant" ADD CONSTRAINT "ArenaParticipant_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ArenaConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
