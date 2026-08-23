// The results use the WAI-ARIA combobox/listbox pattern because native
// datalists cannot expose links to the parent post.
/* oxlint-disable jsx-a11y/prefer-tag-over-role, jsx-a11y/no-noninteractive-element-to-interactive-role, jsx-a11y/control-has-associated-label */
import type { SearchItem } from '@aiworld/shared/schemas/search-response.schema';
import { Link } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type Ref } from 'react';

import {
  MIN_SEARCH_QUERY_LENGTH,
  normalizeSearchQuery,
  useSearch,
} from '../query/use-search';

export function DiscussionSearch({ worldSlug }: { worldSlug: string }) {
  const [value, setValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const query = useSearch(worldSlug, value);
  const normalizedValue = normalizeSearchQuery(value);
  const isTooShort =
    normalizedValue.length > 0 &&
    normalizedValue.length < MIN_SEARCH_QUERY_LENGTH;
  const showDropdown = isOpen && normalizedValue.length > 0;
  const results = query.data?.items ?? [];

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const clear = () => {
    setValue('');
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <label htmlFor="discussion-search" className="sr-only">
        Search discussions
      </label>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
        aria-hidden="true"
      />
      <input
        id="discussion-search"
        type="text"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          if (value.length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            clear();
            return;
          }
          if (!showDropdown || results.length === 0) {
            return;
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % results.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(
              (index) => (index - 1 + results.length) % results.length,
            );
          } else if (event.key === 'Enter' && activeIndex >= 0) {
            event.preventDefault();
            optionRefs.current[activeIndex]?.click();
          }
        }}
        placeholder="Search discussions..."
        autoComplete="off"
        aria-label="Search discussions"
        aria-invalid={isTooShort || undefined}
        aria-describedby={isTooShort ? 'discussion-search-hint' : undefined}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="discussion-search-results"
        aria-activedescendant={
          activeIndex >= 0
            ? `discussion-search-option-${activeIndex}`
            : undefined
        }
        className="h-10 w-full rounded-xl border border-glass-border bg-glass-50 pl-10 pr-10 text-sm text-ink shadow-inner outline-none transition-colors placeholder:text-ink/40 focus:border-brand-sentinel/50 focus:bg-glass-100 focus:ring-2 focus:ring-brand-sentinel/30"
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Clear discussion search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-ink/45 transition-colors hover:bg-glass-50 hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      {showDropdown ? (
        <div
          id="discussion-search-results"
          aria-label="Discussion search results"
          aria-live="polite"
          className="glass-panel absolute inset-x-0 top-full z-50 mt-2 max-h-64 overflow-y-auto rounded-xl bg-surface/95 py-2 shadow-2xl"
        >
          {isTooShort ? (
            <p
              id="discussion-search-hint"
              className="px-3 py-3 text-center text-xs text-ink/60"
            >
              Enter at least 2 characters to search.
            </p>
          ) : query.isPending ? (
            <output
              className="px-3 py-3 text-center text-xs text-ink/60"
              aria-live="polite"
            >
              Searching discussions...
            </output>
          ) : query.isError ? (
            <p
              className="px-3 py-3 text-center text-xs text-rose-300"
              role="alert"
            >
              Could not search discussions.
            </p>
          ) : query.data?.items.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-ink/60">
              No discussions found.
            </p>
          ) : (
            <ul
              className="flex flex-col"
              aria-label="Matching discussions"
              role="listbox"
            >
              {results.map((item, index) => (
                <SearchResultLink
                  key={`${item.type}-${searchItemId(item)}`}
                  worldSlug={worldSlug}
                  item={item}
                  onSelect={() => setIsOpen(false)}
                  optionId={`discussion-search-option-${index}`}
                  active={activeIndex === index}
                  anchorRef={(element) => {
                    optionRefs.current[index] = element;
                  }}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SearchResultLink({
  worldSlug,
  item,
  onSelect,
  optionId,
  active,
  anchorRef,
}: {
  worldSlug: string;
  item: SearchItem;
  onSelect: () => void;
  optionId: string;
  active: boolean;
  anchorRef: Ref<HTMLAnchorElement>;
}) {
  const isPost = item.type === 'post';
  const postId = isPost ? item.post.id : item.comment.postId;
  const title = isPost ? item.post.title : item.comment.content;
  const excerpt = isPost
    ? item.post.content
    : `Comment by ${item.comment.author.name}`;

  return (
    <Link
      id={optionId}
      role="option"
      aria-label={title}
      aria-selected={active}
      tabIndex={-1}
      to="/worlds/$slug/posts/$postId"
      params={{ slug: worldSlug, postId }}
      onClick={onSelect}
      ref={anchorRef}
      className={`block rounded-lg border-b border-glass-border px-3 py-3 last:border-0 hover:bg-glass-50 focus-visible:bg-glass-50 ${active ? 'bg-glass-50' : ''}`}
    >
      <span className="block text-sm font-semibold text-ink">{title}</span>
      <span className="mt-1 block line-clamp-1 text-xs text-ink/55">
        {excerpt}
      </span>
    </Link>
  );
}

function searchItemId(item: SearchItem): string {
  return item.type === 'post' ? item.post.id : item.comment.id;
}
