import { CharacterRecord } from '@/characters/domain/character-record';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { PromptSection } from '@/simulation/actions/action-prompt';
import { WorldRecord } from '@/world/domain/world-record';

const RECENT_ACTIVITY_SECTION_LIMIT = 7_000;
const RECENT_ACTIVITY_TITLE_LIMIT = 200;
const RECENT_ACTIVITY_CONTENT_LIMIT = 1_000;
const RECENT_ACTIVITY_AUTHOR_FIELD_LIMIT = 200;
const TRUNCATION_MARKER = '... [truncated]';
const OMITTED_POSTS_MARKER = '... [older recent posts omitted]';

function truncateText(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }

  if (limit <= 0) {
    return '';
  }
  if (limit <= TRUNCATION_MARKER.length) {
    return TRUNCATION_MARKER.slice(0, limit);
  }

  const contentLimit = limit - TRUNCATION_MARKER.length;
  return `${value.slice(0, contentLimit)}${TRUNCATION_MARKER}`;
}

function formatRecentPost(post: PostWithAuthorRecord): string {
  const authorHandle = truncateText(
    post.author.handle,
    RECENT_ACTIVITY_AUTHOR_FIELD_LIMIT,
  );
  const authorName = truncateText(
    post.author.name,
    RECENT_ACTIVITY_AUTHOR_FIELD_LIMIT,
  );
  const author =
    authorName === authorHandle
      ? `@${authorHandle}`
      : `@${authorHandle} (${authorName})`;

  return [
    `Post by ${author}`,
    `Created: ${post.createdAt.toISOString()}`,
    `Title: ${truncateText(post.title, RECENT_ACTIVITY_TITLE_LIMIT)}`,
    `Content: ${truncateText(post.content, RECENT_ACTIVITY_CONTENT_LIMIT)}`,
  ].join('\n');
}

function appendWithinLimit(
  current: string,
  addition: string,
  limit: number,
): string {
  if (current.length === 0) {
    return truncateText(addition, limit);
  }

  const separator = '\n\n';
  const remaining = limit - current.length - separator.length;
  if (remaining < TRUNCATION_MARKER.length) {
    return current;
  }

  if (addition.length <= remaining) {
    return `${current}${separator}${addition}`;
  }

  return `${current}${separator}${truncateText(addition, remaining)}`;
}

/** Formats a small, reference-only window of persisted posts for POST prompts. */
export function recentActivitySection(
  posts: PostWithAuthorRecord[],
): PromptSection | null {
  if (posts.length === 0) {
    return null;
  }

  const headingPrefix = '## Recent Activity\n';
  const bodyLimit = RECENT_ACTIVITY_SECTION_LIMIT - headingPrefix.length;
  const intro =
    'Reference data from a limited recent window. Use it when relevant; do not assume this is complete memory.';
  let body = intro;
  let included = 0;

  for (const post of posts) {
    const next = appendWithinLimit(body, formatRecentPost(post), bodyLimit);
    if (next === body) {
      break;
    }
    body = next;
    included += 1;
    if (body.length >= bodyLimit) {
      break;
    }
  }

  if (included < posts.length) {
    body = appendWithinLimit(body, OMITTED_POSTS_MARKER, bodyLimit);
  }

  return { heading: 'Recent Activity', body };
}

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

export function currentVoteSection(currentVote: 1 | -1 | null): PromptSection {
  return {
    heading: 'Current vote',
    body:
      currentVote === null
        ? 'No current vote.'
        : `Current vote: ${currentVote === 1 ? 'upvote' : 'downvote'}.`,
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
