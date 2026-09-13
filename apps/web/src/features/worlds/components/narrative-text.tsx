import type { ReactNode } from 'react';

const HANDLE_PATTERN = /(@[A-Za-z0-9_-]+)/g;

export function NarrativeText({ text }: { text: string }): ReactNode {
  return text.split(HANDLE_PATTERN).map((part, index) =>
    part.startsWith('@') ? (
      <strong
        key={`${part}-${index}`}
        className="font-semibold text-brand-sentinel"
      >
        {part}
      </strong>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export function NarrativeParagraphs({ text }: { text: string }): ReactNode {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={`${index}-${paragraph.slice(0, 20)}`}>
        <NarrativeText text={paragraph} />
      </p>
    ));
}
