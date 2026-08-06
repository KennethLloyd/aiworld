-- Keep avatar URLs nullable so characters may use the presentation fallback.
ALTER TABLE "character" DROP COLUMN "avatarSeed";
