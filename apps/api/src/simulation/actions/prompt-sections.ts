import { CharacterRecord } from '@/characters/domain/character-record';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { PromptSection } from '@/simulation/actions/action-prompt';
import { WorldRecord } from '@/world/domain/world-record';

export function worldSection(world: WorldRecord): PromptSection {
  const description = Object.entries(world.description ?? {})
    .map(([label, value]) => `${label}: ${value}`)
    .join('\n');

  return {
    heading: 'World',
    body: [
      `Name: ${world.name}`,
      description ? `Description:\n${description}` : '',
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
      `Identity: @${character.handle}${character.name !== character.handle ? ` (${character.name})` : ''}`,
      character.classification
        ? `Classification: ${character.classification}`
        : '',
      `Biography: ${character.biography}`,
      character.traits.length > 0
        ? `Traits: ${character.traits.join(', ')}`
        : '',
      `Personality instructions: ${character.systemPrompt}`,
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
    (comment) =>
      `[commentId=${comment.id}] @${comment.author.handle}: ${comment.content}`,
  );

  return {
    heading: 'Thread',
    body: lines.length > 0 ? lines.join('\n') : '(no comments yet)',
  };
}
