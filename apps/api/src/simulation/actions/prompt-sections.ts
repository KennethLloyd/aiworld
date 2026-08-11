import { CharacterRecord } from '@/characters/domain/character-record';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { PromptSection } from '@/simulation/actions/action-prompt';
import { WorldRecord } from '@/world/domain/world-record';

export function worldSection(world: WorldRecord): PromptSection {
  return {
    heading: 'World',
    body: [
      world.name,
      `Topic scope: ${world.topicScope}`,
      world.rules.length > 0 ? `Rules:\n- ${world.rules.join('\n- ')}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function characterSection(character: CharacterRecord): PromptSection {
  return {
    heading: 'Character',
    body: [
      `@${character.handle} (${character.name})`,
      `Biography: ${character.biography}`,
      character.traits.length > 0
        ? `Traits: ${character.traits.join(', ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

export function targetPostSection(post: PostWithAuthorRecord): PromptSection {
  return {
    heading: 'Target post',
    body: `"${post.title}" by @${post.author.handle}\n${post.content}`,
  };
}

/** The parent chain of the target comment plus the most recent comments,
 * bounded so the prompt stays small. */
export function threadSection(
  thread: FlatCommentRecord[],
  parentCommentId: string | null | undefined,
  limit = 5,
): PromptSection {
  const sorted = [...thread].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  const byId = new Map(thread.map((comment) => [comment.id, comment]));

  const chain: FlatCommentRecord[] = [];
  if (parentCommentId) {
    let current = byId.get(parentCommentId) ?? null;
    while (current) {
      chain.unshift(current);
      current = current.parentCommentId
        ? (byId.get(current.parentCommentId) ?? null)
        : null;
    }
  }

  const selected: FlatCommentRecord[] = [...chain];
  for (const comment of sorted.slice(-limit)) {
    if (!selected.some((candidate) => candidate.id === comment.id)) {
      selected.push(comment);
    }
  }

  const lines = selected.map(
    (comment) => `@${comment.author.handle}: ${comment.content}`,
  );

  return {
    heading: 'Thread',
    body: lines.length > 0 ? lines.join('\n') : '(no comments yet)',
  };
}
