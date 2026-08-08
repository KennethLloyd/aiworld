-- ADR-0002: every Vote is cast by an active AI WorldMember and links to the
-- voting WorldMember (authorMemberId-style) instead of directly to Character
-- or User. Vote counts are derived by aggregating Vote rows at read time, so
-- the Post/Comment counter columns and their non-negative checks are dropped.
-- The raw partial unique duplicate-vote indexes are rewritten against the new
-- WorldMember reference.

-- Drop the duplicate-vote uniqueness and query indexes keyed on the old
-- principal columns before those columns change.
DROP INDEX "vote_character_post_unique";
DROP INDEX "vote_character_comment_unique";
DROP INDEX "vote_user_post_unique";
DROP INDEX "vote_user_comment_unique";
DROP INDEX "vote_postId_characterId_idx";
DROP INDEX "vote_commentId_characterId_idx";
DROP INDEX "vote_postId_userId_idx";
DROP INDEX "vote_commentId_userId_idx";

ALTER TABLE "vote" DROP CONSTRAINT "vote_one_voter_check";
ALTER TABLE "vote" DROP CONSTRAINT "vote_userId_fkey";
ALTER TABLE "vote" DROP CONSTRAINT "vote_characterId_fkey";

-- Backfill: map each vote's character/user principal to the WorldMember of
-- the target's World. A principal may hold memberships in several Worlds, so
-- the membership is resolved through the voted target's World.
ALTER TABLE "vote" ADD COLUMN "authorMemberId" TEXT;

UPDATE "vote" v
SET "authorMemberId" = wm."id"
FROM "world_member" wm, "post" p
WHERE v."postId" IS NOT NULL
  AND p."id" = v."postId"
  AND wm."worldId" = p."worldId"
  AND wm."characterId" = v."characterId";

UPDATE "vote" v
SET "authorMemberId" = wm."id"
FROM "world_member" wm, "post" p
WHERE v."postId" IS NOT NULL
  AND p."id" = v."postId"
  AND wm."worldId" = p."worldId"
  AND wm."userId" = v."userId";

UPDATE "vote" v
SET "authorMemberId" = wm."id"
FROM "world_member" wm, "comment" c, "post" p
WHERE v."commentId" IS NOT NULL
  AND c."id" = v."commentId"
  AND p."id" = c."postId"
  AND wm."worldId" = p."worldId"
  AND wm."characterId" = v."characterId";

UPDATE "vote" v
SET "authorMemberId" = wm."id"
FROM "world_member" wm, "comment" c, "post" p
WHERE v."commentId" IS NOT NULL
  AND c."id" = v."commentId"
  AND p."id" = c."postId"
  AND wm."worldId" = p."worldId"
  AND wm."userId" = v."userId";

ALTER TABLE "vote" ALTER COLUMN "authorMemberId" SET NOT NULL;

ALTER TABLE "vote" DROP COLUMN "characterId";
ALTER TABLE "vote" DROP COLUMN "userId";

ALTER TABLE "vote" ADD CONSTRAINT "vote_authorMemberId_fkey"
    FOREIGN KEY ("authorMemberId") REFERENCES "world_member"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Drop the denormalized vote counters; rows are the only source of truth.
ALTER TABLE "post" DROP CONSTRAINT "post_vote_counts_check";
ALTER TABLE "comment" DROP CONSTRAINT "comment_vote_counts_check";
ALTER TABLE "post" DROP COLUMN "upvotes";
ALTER TABLE "post" DROP COLUMN "downvotes";
ALTER TABLE "comment" DROP COLUMN "upvotes";
ALTER TABLE "comment" DROP COLUMN "downvotes";

-- Duplicate-vote prevention, keyed on the WorldMember reference. Nullable
-- target columns in a regular composite unique index do not prevent duplicate
-- NULL targets, hence the partial predicates.
CREATE INDEX "vote_authorMemberId_postId_idx"
    ON "vote"("authorMemberId", "postId");
CREATE INDEX "vote_authorMemberId_commentId_idx"
    ON "vote"("authorMemberId", "commentId");
CREATE UNIQUE INDEX "vote_member_post_unique" ON "vote"("authorMemberId", "postId")
    WHERE "authorMemberId" IS NOT NULL AND "postId" IS NOT NULL;
CREATE UNIQUE INDEX "vote_member_comment_unique" ON "vote"("authorMemberId", "commentId")
    WHERE "authorMemberId" IS NOT NULL AND "commentId" IS NOT NULL;
