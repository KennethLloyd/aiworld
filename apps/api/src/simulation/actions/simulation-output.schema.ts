import { z } from 'zod';

export const voteDecisionValues = ['upvote', 'downvote', 'skip'] as const;
export type VoteDecisionValue = (typeof voteDecisionValues)[number];

export const postOutputSchema = z.object({
  title: z.string().trim().min(1),
  content: z.string().trim().min(1),
  reasoning: z.string(),
});

export const voteOutputSchema = z.object({
  decision: z.enum(voteDecisionValues),
  reasoning: z.string(),
});

export const commentOutputSchema = z.object({
  content: z.string().trim().min(1),
  parentCommentId: z.string().nullable(),
  reasoning: z.string(),
});

export type PostOutput = z.infer<typeof postOutputSchema>;
export type VoteOutput = z.infer<typeof voteOutputSchema>;
export type CommentOutput = z.infer<typeof commentOutputSchema>;
