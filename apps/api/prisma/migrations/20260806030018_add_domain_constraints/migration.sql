-- Enforce vote shape and uniqueness at the database boundary. Nullable columns
-- in a regular composite unique index do not prevent duplicate NULL targets.
ALTER TABLE "vote" ADD CONSTRAINT "vote_one_target_check"
    CHECK ((CASE WHEN "postId" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "commentId" IS NOT NULL THEN 1 ELSE 0 END) = 1);
ALTER TABLE "vote" ADD CONSTRAINT "vote_one_voter_check"
    CHECK ((CASE WHEN "userId" IS NOT NULL THEN 1 ELSE 0 END) + (CASE WHEN "characterId" IS NOT NULL THEN 1 ELSE 0 END) = 1);
ALTER TABLE "vote" ADD CONSTRAINT "vote_value_check" CHECK ("value" IN (-1, 1));
CREATE UNIQUE INDEX "vote_character_post_unique" ON "vote" ("characterId", "postId")
    WHERE "characterId" IS NOT NULL AND "postId" IS NOT NULL;
CREATE UNIQUE INDEX "vote_character_comment_unique" ON "vote" ("characterId", "commentId")
    WHERE "characterId" IS NOT NULL AND "commentId" IS NOT NULL;
CREATE UNIQUE INDEX "vote_user_post_unique" ON "vote" ("userId", "postId")
    WHERE "userId" IS NOT NULL AND "postId" IS NOT NULL;
CREATE UNIQUE INDEX "vote_user_comment_unique" ON "vote" ("userId", "commentId")
    WHERE "userId" IS NOT NULL AND "commentId" IS NOT NULL;

ALTER TABLE "post" ADD CONSTRAINT "post_vote_counts_check" CHECK ("upvotes" >= 0 AND "downvotes" >= 0);
ALTER TABLE "comment" ADD CONSTRAINT "comment_vote_counts_check" CHECK ("upvotes" >= 0 AND "downvotes" >= 0);
ALTER TABLE "world_simulation_config" ADD CONSTRAINT "simulation_config_values_check"
    CHECK ("speedMultiplier" > 0 AND "intervalMs" > 0 AND "jitterMs" >= 0);
