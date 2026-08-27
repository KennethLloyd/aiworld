-- Store the current active-member vote total on each Post so Hot feeds can
-- rank and paginate without aggregating Vote rows at read time.
ALTER TABLE "post"
ADD COLUMN "voteScore" INTEGER NOT NULL DEFAULT 0;

UPDATE "post" p
SET "voteScore" = COALESCE(
  (
    SELECT SUM(v."value")
    FROM "vote" v
    INNER JOIN "world_member" wm ON wm."id" = v."authorMemberId"
    WHERE v."postId" = p."id"
      AND wm."isActive" = true
  ),
  0
);

CREATE INDEX "post_worldId_voteScore_createdAt_id_idx"
    ON "post"("worldId", "voteScore" DESC, "createdAt" DESC, "id" ASC);
