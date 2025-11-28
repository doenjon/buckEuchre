-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GamePlayer_gameId_userId_key" ON "GamePlayer"("gameId", "userId");
