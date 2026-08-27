-- Store the current active-member vote total on each Comment so detail,
-- search, and activity reads do not aggregate Vote rows.
ALTER TABLE "comment"
ADD COLUMN "voteScore" INTEGER NOT NULL DEFAULT 0;

UPDATE "comment" c
SET "voteScore" = COALESCE(
  (
    SELECT SUM(v."value")
    FROM "vote" v
    INNER JOIN "world_member" wm ON wm."id" = v."authorMemberId"
    WHERE v."commentId" = c."id"
      AND wm."isActive" = true
  ),
  0
);
