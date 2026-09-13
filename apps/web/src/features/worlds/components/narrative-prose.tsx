import type { ReactNode } from 'react';

const handlePattern = /@[a-zA-Z0-9_-]+/g;

export function NarrativeProse({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <div className={className}>
      {paragraphs.map((paragraph, index) => (
        <p
          key={`${index}-${paragraph}`}
          className={index > 0 ? 'mt-4' : undefined}
        >
          {renderHandles(paragraph)}
        </p>
      ))}
    </div>
  );
}

function renderHandles(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(handlePattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      parts.push(text.slice(cursor, index));
    }
    parts.push(
      <span
        key={`${index}-${match[0]}`}
        className="font-semibold text-brand-sentinel"
      >
        {match[0]}
      </span>,
    );
    cursor = index + match[0].length;
  }
  if (cursor < text.length) {
    parts.push(text.slice(cursor));
  }
  return parts;
}
