CREATE TYPE "WorldMemberRole" AS ENUM ('HUMAN', 'AI');

CREATE TABLE "world_member" (
    "id" TEXT NOT NULL,
    "worldId" TEXT NOT NULL,
    "userId" TEXT,
    "characterId" TEXT,
    "role" "WorldMemberRole" NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "world_member_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "character" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "character" ALTER COLUMN "avatarSeed" DROP NOT NULL;
ALTER TABLE "post" ADD COLUMN "authorMemberId" TEXT;
ALTER TABLE "comment" ADD COLUMN "authorMemberId" TEXT;

-- Migrate existing character ownership into AI WorldMember records before the
-- direct Character -> World relationship and character author columns change.
INSERT INTO "world_member" ("id", "worldId", "characterId", "role")
SELECT
    substr(md5('world-member:' || c."id"), 1, 8) || '-' ||
    substr(md5('world-member:' || c."id"), 9, 4) || '-4' ||
    substr(md5('world-member:' || c."id"), 14, 3) || '-8' ||
    substr(md5('world-member:' || c."id"), 18, 3) || '-' ||
    substr(md5('world-member:' || c."id"), 21, 12),
    c."worldId",
    c."id",
    'AI'
FROM "character" c;

UPDATE "post" p
SET "authorMemberId" = wm."id"
FROM "world_member" wm
WHERE wm."worldId" = p."worldId"
  AND wm."characterId" = p."authorCharacterId";

UPDATE "comment" c
SET "authorMemberId" = wm."id"
FROM "world_member" wm, "post" p
WHERE wm."worldId" = p."worldId"
  AND p."id" = c."postId"
  AND wm."characterId" = c."authorCharacterId";

ALTER TABLE "post" ALTER COLUMN "authorMemberId" SET NOT NULL;
ALTER TABLE "comment" ALTER COLUMN "authorMemberId" SET NOT NULL;

ALTER TABLE "post" DROP CONSTRAINT "post_authorCharacterId_fkey";
ALTER TABLE "comment" DROP CONSTRAINT "comment_authorCharacterId_fkey";
ALTER TABLE "character" DROP CONSTRAINT "character_worldId_fkey";

DROP INDEX "post_authorCharacterId_createdAt_idx";
DROP INDEX "comment_authorCharacterId_createdAt_idx";
DROP INDEX "character_worldId_handle_key";
DROP INDEX "character_worldId_isActive_idx";
DROP INDEX "character_worldId_classification_idx";
DROP INDEX "character_worldId_classificationGroup_idx";

ALTER TABLE "post" DROP COLUMN "authorCharacterId";
ALTER TABLE "comment" DROP COLUMN "authorCharacterId";
ALTER TABLE "character" DROP COLUMN "worldId";

CREATE UNIQUE INDEX "character_handle_key" ON "character"("handle");
CREATE INDEX "character_isActive_idx" ON "character"("isActive");
CREATE INDEX "character_classification_idx" ON "character"("classification");
CREATE INDEX "character_classificationGroup_idx" ON "character"("classificationGroup");
CREATE INDEX "post_authorMemberId_createdAt_idx" ON "post"("authorMemberId", "createdAt");
CREATE INDEX "comment_authorMemberId_createdAt_idx" ON "comment"("authorMemberId", "createdAt");
CREATE INDEX "world_member_worldId_role_idx" ON "world_member"("worldId", "role");
CREATE INDEX "world_member_userId_idx" ON "world_member"("userId");
CREATE INDEX "world_member_characterId_idx" ON "world_member"("characterId");

ALTER TABLE "world_member" ADD CONSTRAINT "world_member_one_principal_check"
    CHECK ((CASE WHEN "userId" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "characterId" IS NOT NULL THEN 1 ELSE 0 END) = 1);
ALTER TABLE "world_member" ADD CONSTRAINT "world_member_role_principal_check"
    CHECK (("role" = 'HUMAN' AND "userId" IS NOT NULL) OR ("role" = 'AI' AND "characterId" IS NOT NULL));
CREATE UNIQUE INDEX "world_member_world_user_unique" ON "world_member"("worldId", "userId")
    WHERE "userId" IS NOT NULL;
CREATE UNIQUE INDEX "world_member_world_character_unique" ON "world_member"("worldId", "characterId")
    WHERE "characterId" IS NOT NULL;

ALTER TABLE "world_member" ADD CONSTRAINT "world_member_worldId_fkey"
    FOREIGN KEY ("worldId") REFERENCES "world"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "world_member" ADD CONSTRAINT "world_member_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "world_member" ADD CONSTRAINT "world_member_characterId_fkey"
    FOREIGN KEY ("characterId") REFERENCES "character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post" ADD CONSTRAINT "post_authorMemberId_fkey"
    FOREIGN KEY ("authorMemberId") REFERENCES "world_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comment" ADD CONSTRAINT "comment_authorMemberId_fkey"
    FOREIGN KEY ("authorMemberId") REFERENCES "world_member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
