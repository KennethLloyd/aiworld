-- AlterTable
ALTER TABLE "simulation_runtime_state"
ADD COLUMN "deadLetterCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastDeadLetterAt" TIMESTAMP(3),
ADD COLUMN "lastDeadLetterReason" TEXT;
