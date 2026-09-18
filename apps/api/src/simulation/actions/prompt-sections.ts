import { CharacterView } from '@/characters/characters.service';
import { FlatComment } from '@/comments/domain/comment';
import { PostWithAuthor } from '@/posts/domain/post';
import { PromptSection } from '@/simulation/actions/action-prompt';
import { WorldView } from '@/world/world.service';

export function worldSection(world: WorldView): PromptSection {
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

export function characterSection(character: CharacterView): PromptSection {
  return {
    heading: 'Character',
    body: [
      `Identity: @${character.handle}${character.name !== character.handle ? ` (${character.name})` : ''}`,
      character.gender ? `Gender: ${character.gender}` : '',
      character.pronouns ? `Pronouns: ${character.pronouns}` : '',
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

export function characterNarrativeMemorySection(
  narrativeMemory: string,
): PromptSection | null {
  const memory = narrativeMemory.trim();
  return memory ? { heading: 'Personal narrative memory', body: memory } : null;
}

export function recentEventsSection(
  recentEvents: string | null,
): PromptSection | null {
  const events = recentEvents?.trim();
  return events ? { heading: 'Recent Events', body: events } : null;
}

export function currentVoteSection(currentVote: 1 | -1 | null): PromptSection {
  return {
    heading: 'Current vote',
    body:
      currentVote === null
        ? 'No current vote.'
        : `Current vote: ${currentVote === 1 ? 'upvote' : 'downvote'}.`,
  };
}

export function targetPostSection(post: PostWithAuthor): PromptSection {
  return {
    heading: 'Target post',
    body: [
      `"${post.title}" by ${formatAuthorReference(post.author)}`,
      post.content,
    ].join('\n'),
  };
}

/** The parent chain of the target comment plus the most recent comments,
 * bounded so the prompt stays small. */
export function threadSection(
  thread: FlatComment[],
  parentCommentId: string | null | undefined,
  limit = 5,
): PromptSection {
  const sorted = [...thread].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  const byId = new Map(thread.map((comment) => [comment.id, comment]));

  const chain: FlatComment[] = [];
  if (parentCommentId) {
    let current = byId.get(parentCommentId) ?? null;
    while (current) {
      chain.unshift(current);
      current = current.parentCommentId
        ? (byId.get(current.parentCommentId) ?? null)
        : null;
    }
  }

  const selected: FlatComment[] = [...chain];
  for (const comment of sorted.slice(-limit)) {
    if (!selected.some((candidate) => candidate.id === comment.id)) {
      selected.push(comment);
    }
  }

  const lines = selected.map(
    (comment) =>
      `[commentId=${comment.id}] ${formatAuthorReference(comment.author)}: ${comment.content}`,
  );

  return {
    heading: 'Thread',
    body: lines.length > 0 ? lines.join('\n') : '(no comments yet)',
  };
}

function formatAuthorReference(author: {
  handle: string;
  gender?: string | null;
  pronouns?: string | null;
}): string {
  const identity = [
    author.gender ? `(gender: ${author.gender})` : '',
    author.pronouns ? `(pronouns: ${author.pronouns})` : '',
  ].filter(Boolean);
  return [`@${author.handle}`, ...identity].join(' ');
}
