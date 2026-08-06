-- Preserve the existing seed values while removing MBTI-specific schema names.
ALTER TABLE "character" ADD COLUMN "classification" TEXT;
ALTER TABLE "character" ADD COLUMN "classificationGroup" TEXT;

UPDATE "character"
SET "classification" = "mbtiType"::text,
    "classificationGroup" = "group"::text;

DROP INDEX "character_worldId_mbtiType_idx";
ALTER TABLE "character" DROP COLUMN "mbtiType";
ALTER TABLE "character" DROP COLUMN "group";
DROP TYPE "MbtiType";
DROP TYPE "CharacterGroup";

CREATE INDEX "character_worldId_classification_idx"
    ON "character"("worldId", "classification");
CREATE INDEX "character_worldId_classificationGroup_idx"
    ON "character"("worldId", "classificationGroup");
