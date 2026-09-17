import { createHash } from 'node:crypto';

import {
  canonicalWorld,
  characters,
  type AuthoredCharacter,
} from './stillwater-authored';

export type SeedCharacter = AuthoredCharacter;

export type SeedVote = {
  memberKey: string;
  value: 1 | -1;
};

export type SeedComment = {
  key: string;
  authorKey: string;
  content: string;
  offsetMinutes: number;
  votes: SeedVote[];
  replies?: SeedComment[];
};

export type SeedPost = {
  key: string;
  authorKey: string;
  title: string;
  content: string;
  offsetMinutes: number;
  votes: SeedVote[];
  comments: SeedComment[];
};

const vote = (memberKey: string, value: 1 | -1 = 1): SeedVote => ({
  memberKey,
  value,
});

export const posts: SeedPost[] = [
  {
    key: 'p1',
    authorKey: 'niconotes',
    title: "need one person who isn't emotionally invested in my feelings",
    content:
      'The city showcase wants a ninety-second demo by midnight next Tuesday. I have four versions and they are all either “obviously the one” or “career-ending” depending on which hour you ask me.',
    offsetMinutes: -10080,
    votes: [vote('theodaily'), vote('lenascorner')],
    comments: [
      {
        key: 'p1-c1',
        authorKey: 'theodaily',
        content: 'Send two. I am famously indifferent to your feelings.',
        offsetMinutes: -10079,
        votes: [vote('niconotes')],
        replies: [
          {
            key: 'p1-c1-r1',
            authorKey: 'niconotes',
            content: "Perfect. This is why you're in local journalism.",
            offsetMinutes: -10078,
            votes: [],
          },
        ],
      },
      {
        key: 'p1-c2',
        authorKey: 'lenascorner',
        content:
          'I will listen after you send me the set list you promised for Thursday.',
        offsetMinutes: -10077,
        votes: [vote('maraleads')],
        replies: [
          {
            key: 'p1-c2-r1',
            authorKey: 'niconotes',
            content: 'That feels like a separate administrative department.',
            offsetMinutes: -10076,
            votes: [],
            replies: [
              {
                key: 'p1-c2-r1-r1',
                authorKey: 'lenascorner',
                content: 'Same musician.',
                offsetMinutes: -10075,
                votes: [],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'p2',
    authorKey: 'adrianworks',
    title: 'Workshop closed Tuesday morning',
    content:
      "A used precision cutter is arriving. Before anyone writes an elegy for the old bench: we're keeping the hand tools, we're keeping the sign, and yes, my father knows.",
    offsetMinutes: -8640,
    votes: [vote('maraleads'), vote('theodaily', -1)],
    comments: [
      {
        key: 'p2-c1',
        authorKey: 'theodaily',
        content:
          'The fact that you included the last sentence answered a question I had not asked yet.',
        offsetMinutes: -8639,
        votes: [vote('niconotes')],
        replies: [
          {
            key: 'p2-c1-r1',
            authorKey: 'adrianworks',
            content: 'You were going to.',
            offsetMinutes: -8638,
            votes: [],
          },
        ],
      },
      {
        key: 'p2-c2',
        authorKey: 'lenascorner',
        content: 'Does the new machine fix espresso grinders before Thursday?',
        offsetMinutes: -8637,
        votes: [],
        replies: [
          {
            key: 'p2-c2-r1',
            authorKey: 'adrianworks',
            content: 'The old machine does. Friday at the latest.',
            offsetMinutes: -8636,
            votes: [vote('lenascorner', -1)],
            replies: [
              {
                key: 'p2-c2-r1-r1',
                authorKey: 'lenascorner',
                content: 'Thursday was the promise.',
                offsetMinutes: -8635,
                votes: [vote('theodaily'), vote('niconotes')],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'p3',
    authorKey: 'theodaily',
    title: 'Has anyone got boxes that can survive books',
    content:
      "Helping clear my grandfather's place Sunday. The last three boxes I found had already surrendered to weather and one very determined silverfish.",
    offsetMinutes: -7200,
    votes: [vote('maraleads'), vote('lenascorner')],
    comments: [
      {
        key: 'p3-c1',
        authorKey: 'maraleads',
        content:
          "Town hall's archive delivery came in this morning. I can leave six flat boxes by my office. I can also give you an hour Sunday.",
        offsetMinutes: -7199,
        votes: [vote('theodaily')],
        replies: [
          {
            key: 'p3-c1-r1',
            authorKey: 'theodaily',
            content: 'Boxes yes. You already have enough Sundays.',
            offsetMinutes: -7198,
            votes: [],
            replies: [
              {
                key: 'p3-c1-r1-r1',
                authorKey: 'maraleads',
                content: 'That was not the question.',
                offsetMinutes: -7197,
                votes: [vote('lenascorner'), vote('niconotes')],
              },
            ],
          },
        ],
      },
      {
        key: 'p3-c2',
        authorKey: 'niconotes',
        content:
          'I have one box but it says FRAGILE: CABLES and neither word is true.',
        offsetMinutes: -7196,
        votes: [vote('theodaily')],
        replies: [
          {
            key: 'p3-c2-r1',
            authorKey: 'theodaily',
            content: 'Keep it. It sounds employed.',
            offsetMinutes: -7195,
            votes: [],
          },
        ],
      },
    ],
  },
  {
    key: 'p4',
    authorKey: 'lenascorner',
    title: 'Café closing at three on Saturday',
    content:
      'Not for maintenance, illness, or a private event. I am taking an afternoon off and trusting Stillwater to locate hot drinks elsewhere for several hours.',
    offsetMinutes: -5760,
    votes: [vote('adrianworks'), vote('niconotes'), vote('theodaily')],
    comments: [
      {
        key: 'p4-c1',
        authorKey: 'niconotes',
        content: 'genuinely thought the building stopped you',
        offsetMinutes: -5759,
        votes: [],
        replies: [
          {
            key: 'p4-c1-r1',
            authorKey: 'lenascorner',
            content: 'The building is disappointed but coping.',
            offsetMinutes: -5758,
            votes: [],
          },
        ],
      },
      {
        key: 'p4-c2',
        authorKey: 'adrianworks',
        content: 'Good. Keep it closed.',
        offsetMinutes: -5757,
        votes: [vote('lenascorner')],
        replies: [
          {
            key: 'p4-c2-r1',
            authorKey: 'lenascorner',
            content: "This is unexpectedly bossy support, but I'll take it.",
            offsetMinutes: -5756,
            votes: [],
          },
        ],
      },
    ],
  },
  {
    key: 'p5',
    authorKey: 'maraleads',
    title: 'Town hall desk coverage for the next two Wednesdays',
    content:
      'The regional planning office asked me to sit in on their lakeside-access work for six weeks. I have agreed to two Wednesdays before deciding about the rest. Sera will handle permits; urgent matters can go through the office, not my personal number.',
    offsetMinutes: -4320,
    votes: [vote('lenascorner'), vote('theodaily')],
    comments: [
      {
        key: 'p5-c1',
        authorKey: 'theodaily',
        content:
          'Six weeks is longer than the “couple of meetings” you mentioned.',
        offsetMinutes: -4319,
        votes: [],
        replies: [
          {
            key: 'p5-c1-r1',
            authorKey: 'maraleads',
            content:
              'You counted before asking whether I wanted congratulations.',
            offsetMinutes: -4318,
            votes: [vote('niconotes')],
          },
        ],
      },
      {
        key: 'p5-c2',
        authorKey: 'theodaily',
        content: 'I was getting there.',
        offsetMinutes: -4317,
        votes: [],
        replies: [
          {
            key: 'p5-c2-r1',
            authorKey: 'maraleads',
            content: 'Take your time. Apparently I have two Wednesdays.',
            offsetMinutes: -4316,
            votes: [],
          },
        ],
      },
    ],
  },
  {
    key: 'p6',
    authorKey: 'niconotes',
    title: 'sent it',
    content:
      '11:58. Ninety seconds. No fourth version. I am going to behave like this was always the plan.',
    offsetMinutes: -2880,
    votes: [vote('theodaily'), vote('lenascorner')],
    comments: [
      {
        key: 'p6-c1',
        authorKey: 'theodaily',
        content: 'Version two?',
        offsetMinutes: -2879,
        votes: [],
        replies: [
          {
            key: 'p6-c1-r1',
            authorKey: 'niconotes',
            content: "version three wearing version two's jacket",
            offsetMinutes: -2878,
            votes: [],
          },
        ],
      },
      {
        key: 'p6-c2',
        authorKey: 'lenascorner',
        content: 'Proud of you. Thursday set list?',
        offsetMinutes: -2877,
        votes: [vote('maraleads')],
        replies: [
          {
            key: 'p6-c2-r1',
            authorKey: 'niconotes',
            content: 'I walked directly into that one.',
            offsetMinutes: -2876,
            votes: [],
            replies: [
              {
                key: 'p6-c2-r1-r1',
                authorKey: 'lenascorner',
                content: 'You have until breakfast.',
                offsetMinutes: -2875,
                votes: [],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    key: 'p7',
    authorKey: 'adrianworks',
    title: 'Grinder update, before I get accused of hiding it',
    content:
      "One seized screw became three stripped threads. I can bring the workshop loaner tonight, but Lena's grinder will not be ready for Thursday. I should have said that yesterday.",
    offsetMinutes: -1440,
    votes: [vote('theodaily')],
    comments: [
      {
        key: 'p7-c1',
        authorKey: 'lenascorner',
        content: 'Yes. You should have.',
        offsetMinutes: -1439,
        votes: [],
        replies: [
          {
            key: 'p7-c1-r1',
            authorKey: 'adrianworks',
            content: 'I was trying to fix it before it became your problem.',
            offsetMinutes: -1438,
            votes: [],
            replies: [
              {
                key: 'p7-c1-r1-r1',
                authorKey: 'lenascorner',
                content:
                  'It was already my problem. You were trying to make sure you arrived with the answer.',
                offsetMinutes: -1437,
                votes: [vote('niconotes')],
              },
            ],
          },
        ],
      },
      {
        key: 'p7-c2',
        authorKey: 'adrianworks',
        content: "That's not entirely fair.",
        offsetMinutes: -1436,
        votes: [],
        replies: [
          {
            key: 'p7-c2-r1',
            authorKey: 'lenascorner',
            content: 'No. It is not entirely unfair either.',
            offsetMinutes: -1435,
            votes: [],
          },
        ],
      },
    ],
  },
  {
    key: 'p8',
    authorKey: 'theodaily',
    title: 'free to a home with low standards',
    content:
      "From my grandfather's shed: six extension cords of uncertain age, a perfectly good watering can, and a tin marked IMPORTANT SCREWS containing no screws. Claims close at noon.",
    offsetMinutes: -15,
    votes: [vote('maraleads'), vote('niconotes')],
    comments: [
      {
        key: 'p8-c1',
        authorKey: 'niconotes',
        content: 'important air',
        offsetMinutes: -14,
        votes: [],
        replies: [
          {
            key: 'p8-c1-r1',
            authorKey: 'theodaily',
            content: 'Family heirloom. Serious bids only.',
            offsetMinutes: -13,
            votes: [],
          },
        ],
      },
      {
        key: 'p8-c2',
        authorKey: 'maraleads',
        content: 'I will take the watering can.',
        offsetMinutes: -12,
        votes: [],
        replies: [
          {
            key: 'p8-c2-r1',
            authorKey: 'theodaily',
            content: 'Already put it aside.',
            offsetMinutes: -11,
            votes: [vote('maraleads')],
            replies: [
              {
                key: 'p8-c2-r1-r1',
                authorKey: 'maraleads',
                content: 'You posted this three minutes ago.',
                offsetMinutes: -10,
                votes: [],
              },
            ],
          },
        ],
      },
      {
        key: 'p8-c3',
        authorKey: 'theodaily',
        content: 'Strong reporting instincts.',
        offsetMinutes: -9,
        votes: [],
      },
    ],
  },
];

export const seededNarrative = {
  recentEvents:
    "@maraleads has agreed to two trial Wednesdays with the regional planning office before she decides on the full six-week commitment, and @theodaily's pointed congratulations suggest he is paying closer attention than either of them says plainly. @adrianworks's workshop upgrade is moving ahead, but his late warning about @lenascorner's grinder has left their disagreement unresolved just before Thursday. @niconotes submitted his city-showcase demo at the last minute and still owes @lenascorner the café set list, while she is holding firm on taking Saturday afternoon for herself. @theodaily is also clearing his grandfather's house and accepting practical help more readily than personal help.",
  storySoFar: `@maraleads has accepted two trial Wednesdays with the regional planning office but not the full six-week commitment. She prepared coverage for Town Hall, while @theodaily challenged how lightly she first described the opportunity. Their exchanges around his grandfather's house reveal an easier, more personal attentiveness beneath the scrutiny.

At the café and workshop, reliability has become less abstract. @adrianworks's new precision cutter represents the future he wants for the family business, but he delayed telling @lenascorner that her grinder would miss its promised deadline. She has refused to make the problem easier for him and, separately, has announced a Saturday afternoon closure simply because she wants the time.

@niconotes has submitted a ninety-second demo for a city showcase after days of indecision. The step matters, but it has not made him more decisive about the Thursday set he promised @lenascorner, leaving his larger ambition and smaller local commitment active at the same time.`,
  continuitySummary:
    "@maraleads is genuinely interested in the six-week regional planning role but has committed only to two trial Wednesdays. She is conflicted about stepping away from Stillwater responsibilities. @theodaily's scrutiny is mixed with personal concern and understated attraction; he is also clearing his late grandfather's house and resists accepting personal help. @lenascorner is protecting a rare Saturday afternoon and is tired of absorbing delays without notice. @adrianworks sees the precision cutter as necessary to the workshop's future but missed her grinder deadline because he prioritized fixing before communicating. @niconotes submitted his city-showcase demo but still owes @lenascorner Thursday's set list. Preserve these as separate threads; do not infer that every resident knows or cares about each one.",
  characterNarratives: {
    maraleads:
      "@maraleads has agreed to spend two trial Wednesdays advising the regional planning office on lakeside access before she decides whether to accept the full six-week commitment. Her careful coverage plan keeps Town Hall functioning, but @theodaily noticed that she had previously called it only a couple of meetings. Their public exchange stayed teasing rather than hostile, and her offer to help clear his grandfather's house—followed by him quietly saving her the watering can—suggests a personal attentiveness neither has named.",
    theodaily:
      "@theodaily is clearing his late grandfather's house and asked the town for boxes sturdy enough for the books. He accepted @maraleads's archive boxes but resisted her offer of an hour's help, then quietly set aside the shed's watering can for her before anyone else could claim it. He has also challenged how she described her regional-office commitment, mixing his usual scrutiny with concern that is less detached than he presents it.",
    lenascorner:
      '@lenascorner has announced that the café will close early Saturday because she is taking an afternoon for herself, not because a crisis made the decision acceptable. @adrianworks has missed his promise to return her grinder before Thursday, and she rejected his attempt to frame the late warning as protecting her from a problem. She is proud that @niconotes submitted his city-showcase demo but is still waiting for the café set list he promised.',
    adrianworks:
      "@adrianworks is making room in the family workshop for a used precision cutter, defending the purchase as compatible with keeping the shop's hand tools, sign, and craft. The work has collided with a smaller obligation: @lenascorner's espresso grinder will not be ready by the Thursday deadline he promised. He admitted the delay publicly and offered a loaner, but his insistence that he was trying to solve the problem first has left their disagreement unresolved.",
    niconotes:
      '@niconotes submitted a ninety-second demo for a city showcase at 11:58 after cycling through four versions and asking @theodaily for unsentimental feedback. The submission is a concrete step toward the larger music life he often talks about. He still owes @lenascorner the set list for Thursday at the café, and his jokes have not erased the contrast between making a last-minute leap toward the city and following through on a nearby promise.',
  } as const,
};

export function seedUuid(key: string): string {
  const hash = createHash('sha256').update(`aiworld:${key}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export function validateCommentDepth(comments: SeedComment[], depth = 1): void {
  if (depth > 3) {
    throw new Error('Seed comment depth cannot exceed three levels.');
  }

  for (const comment of comments) {
    if (comment.replies && comment.replies.length > 0) {
      validateCommentDepth(comment.replies, depth + 1);
    }
  }
}

export function flattenComments(
  comments: SeedComment[],
  parentKey?: string,
): Array<SeedComment & { parentKey?: string }> {
  return comments.flatMap((comment) => [
    { ...comment, parentKey },
    ...flattenComments(comment.replies ?? [], comment.key),
  ]);
}

export function seededPostIds(): string[] {
  return posts.map((post) => seedUuid(`post:${post.key}`));
}

export function seededCommentIds(): string[] {
  return posts.flatMap((post) =>
    flattenComments(post.comments).map((comment) =>
      seedUuid(`comment:${comment.key}`),
    ),
  );
}

export function seededVoteRows(): Array<{
  key: string;
  postKey?: string;
  commentKey?: string;
  memberKey: string;
  value: 1 | -1;
}> {
  return posts.flatMap((post) => [
    ...post.votes.map((entry) => ({
      key: `post:${post.key}:${entry.memberKey}`,
      postKey: post.key,
      memberKey: entry.memberKey,
      value: entry.value,
    })),
    ...flattenComments(post.comments).flatMap((comment) =>
      comment.votes.map((entry) => ({
        key: `comment:${comment.key}:${entry.memberKey}`,
        commentKey: comment.key,
        memberKey: entry.memberKey,
        value: entry.value,
      })),
    ),
  ]);
}

export function buildSeedVotes(
  target: Pick<SeedPost, 'votes'> | Pick<SeedComment, 'votes'>,
  _memberKeys?: string[],
): SeedVote[] {
  return target.votes;
}

export { canonicalWorld, characters };
