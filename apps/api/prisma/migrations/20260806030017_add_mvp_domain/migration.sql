-- CreateEnum
CREATE TYPE "MbtiType" AS ENUM ('ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'INTJ', 'INTP', 'ENTJ', 'ENTP');

-- CreateEnum
CREATE TYPE "CharacterGroup" AS ENUM ('SJ', 'SP', 'NF', 'NT');

-- CreateEnum
CREATE TYPE "SimulationState" AS ENUM ('RUNNING', 'PAUSED', 'HALTED');

-- CreateEnum
CREATE TYPE "SimulationAction" AS ENUM ('POST', 'VOTE', 'COMMENT');

-- CreateEnum
CREATE TYPE "SimulationExecutionSource" AS ENUM ('SCHEDULED', 'MANUAL', 'RUN_ONE_CYCLE');

-- CreateEnum
CREATE TYPE "SimulationLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "character" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mbtiType" "MbtiType",
    "group" "CharacterGroup" NOT NULL,
    "avatarSeed" TEXT NOT NULL,
    "biography" TEXT NOT NULL,
    "traits" JSONB NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "authorCharacterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorCharacterId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "content" TEXT NOT NULL,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vote" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "commentId" TEXT,
    "userId" TEXT,
    "characterId" TEXT,
    "value" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_log" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "action" "SimulationAction" NOT NULL,
    "targetId" TEXT,
    "reasoning" TEXT,
    "promptUsed" TEXT,
    "responseRaw" TEXT,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "executionSource" "SimulationExecutionSource" NOT NULL,
    "tokensUsed" INTEGER,
    "costEstimate" DECIMAL(12,6),
    "status" "SimulationLogStatus" NOT NULL,
    "errorMessage" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "world_simulation_config" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "state" "SimulationState" NOT NULL DEFAULT 'PAUSED',
    "speedMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "intervalMs" INTEGER NOT NULL DEFAULT 30000,
    "jitterMs" INTEGER NOT NULL DEFAULT 5000,
    "actionWeights" JSONB NOT NULL,
    "providerId" TEXT NOT NULL DEFAULT 'mock',
    "model" TEXT NOT NULL DEFAULT 'fixture-model',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "world_simulation_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "character_worldId_isActive_idx" ON "character"("worldId", "isActive");

-- CreateIndex
CREATE INDEX "character_worldId_mbtiType_idx" ON "character"("worldId", "mbtiType");

-- CreateIndex
CREATE UNIQUE INDEX "character_worldId_handle_key" ON "character"("worldId", "handle");

-- CreateIndex
CREATE INDEX "post_worldId_createdAt_idx" ON "post"("worldId", "createdAt");

-- CreateIndex
CREATE INDEX "post_authorCharacterId_createdAt_idx" ON "post"("authorCharacterId", "createdAt");

-- CreateIndex
CREATE INDEX "comment_postId_createdAt_idx" ON "comment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "comment_authorCharacterId_createdAt_idx" ON "comment"("authorCharacterId", "createdAt");

-- CreateIndex
CREATE INDEX "comment_parentCommentId_createdAt_idx" ON "comment"("parentCommentId", "createdAt");

-- CreateIndex
CREATE INDEX "vote_postId_characterId_idx" ON "vote"("postId", "characterId");

-- CreateIndex
CREATE INDEX "vote_commentId_characterId_idx" ON "vote"("commentId", "characterId");

-- CreateIndex
CREATE INDEX "vote_postId_userId_idx" ON "vote"("postId", "userId");

-- CreateIndex
CREATE INDEX "vote_commentId_userId_idx" ON "vote"("commentId", "userId");

-- CreateIndex
CREATE INDEX "simulation_log_worldId_executedAt_idx" ON "simulation_log"("worldId", "executedAt");

-- CreateIndex
CREATE INDEX "simulation_log_worldId_action_executedAt_idx" ON "simulation_log"("worldId", "action", "executedAt");

-- CreateIndex
CREATE INDEX "simulation_log_characterId_executedAt_idx" ON "simulation_log"("characterId", "executedAt");

-- CreateIndex
CREATE INDEX "simulation_log_status_executedAt_idx" ON "simulation_log"("status", "executedAt");

-- CreateIndex
CREATE UNIQUE INDEX "world_simulation_config_worldId_key" ON "world_simulation_config"("worldId");

-- AddForeignKey
ALTER TABLE "character" ADD CONSTRAINT "character_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "world"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "world"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post" ADD CONSTRAINT "post_authorCharacterId_fkey" FOREIGN KEY ("authorCharacterId") REFERENCES "character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_authorCharacterId_fkey" FOREIGN KEY ("authorCharacterId") REFERENCES "character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_postId_fkey" FOREIGN KEY ("postId") REFERENCES "post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vote" ADD CONSTRAINT "vote_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_log" ADD CONSTRAINT "simulation_log_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "world"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_log" ADD CONSTRAINT "simulation_log_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "world_simulation_config" ADD CONSTRAINT "world_simulation_config_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "world"("id") ON DELETE CASCADE ON UPDATE CASCADE;
