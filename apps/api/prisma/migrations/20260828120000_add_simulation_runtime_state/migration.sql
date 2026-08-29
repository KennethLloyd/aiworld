-- CreateTable
CREATE TABLE "simulation_runtime_state" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "workExpected" BOOLEAN NOT NULL DEFAULT false,
    "nextTickAt" TIMESTAMP(3),
    "lastTickStartedAt" TIMESTAMP(3),
    "lastTickCompletedAt" TIMESTAMP(3),
    "retrying" BOOLEAN NOT NULL DEFAULT false,
    "recentRetryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "bootResumeFailureAt" TIMESTAMP(3),
    "bootResumeFailureReason" TEXT,

    CONSTRAINT "simulation_runtime_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "simulation_runtime_state_worldId_key" ON "simulation_runtime_state"("worldId");

-- AddForeignKey
ALTER TABLE "simulation_runtime_state" ADD CONSTRAINT "simulation_runtime_state_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "world"("id") ON DELETE CASCADE ON UPDATE CASCADE;
