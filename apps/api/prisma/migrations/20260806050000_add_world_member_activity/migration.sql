ALTER TABLE "world_member"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "world_member_worldId_isActive_idx"
ON "world_member"("worldId", "isActive");
