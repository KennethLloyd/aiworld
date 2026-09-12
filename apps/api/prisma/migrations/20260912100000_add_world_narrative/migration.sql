CREATE TABLE "world_narrative" (
    "worldId" TEXT NOT NULL,
    "recentEvents" TEXT,
    "storySoFar" TEXT,
    "continuitySummary" TEXT NOT NULL DEFAULT '',
    "lastPostAt" TIMESTAMP(3),
    "lastPostId" TEXT,
    "lastCommentAt" TIMESTAMP(3),
    "lastCommentId" TEXT,

    CONSTRAINT "world_narrative_pkey" PRIMARY KEY ("worldId")
);

ALTER TABLE "world_narrative" ADD CONSTRAINT "world_narrative_worldId_fkey"
  FOREIGN KEY ("worldId") REFERENCES "world"("id") ON DELETE CASCADE ON UPDATE CASCADE;
