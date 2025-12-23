-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "showAIHints" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserSettings" ADD COLUMN "aiHintDifficulty" TEXT NOT NULL DEFAULT 'medium';
