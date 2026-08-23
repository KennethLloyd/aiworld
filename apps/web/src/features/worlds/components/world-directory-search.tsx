import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input } from '@/shared/ui/input';

/** Header search for the public worlds directory. The URL remains canonical. */
export function WorldDirectorySearch() {
  const search = useRouterState({
    select: (state) =>
      state.location.search as {
        search?: string;
        page?: number;
        limit?: number;
      },
  });
  const navigate = useNavigate();
  const [draft, setDraft] = useState(search.search ?? '');
  const debouncedDraft = useDebouncedValue(draft, 300);
  const urlSearch = search.search ?? '';
  const isSearching = draft !== urlSearch || debouncedDraft !== draft;

  useEffect(() => {
    setDraft(search.search ?? '');
  }, [search.search]);

  useEffect(() => {
    const normalizedSearch = debouncedDraft.trim();
    if (normalizedSearch === urlSearch) {
      return;
    }
    void navigate({
      search: (previous) => ({
        ...previous,
        search: normalizedSearch === '' ? undefined : normalizedSearch,
        page: 1,
      }),
    });
  }, [debouncedDraft, navigate, urlSearch]);

  const clearSearch = () => {
    setDraft('');
    window.location.assign(`/worlds?page=1&limit=${search.limit ?? 20}`);
  };

  return (
    <div className="relative w-full">
      <Input
        aria-label="Search worlds"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search by name or topic..."
        autoComplete="off"
        className="!h-[38px] !bg-glass-50 pl-10 pr-10 shadow-inner"
      />
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
      />
      {draft.length > 0 ? (
        <button
          type="button"
          aria-label="Clear world search"
          title="Clear world search"
          onClick={clearSearch}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink/70 hover:bg-glass-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      {isSearching ? (
        <output
          className="absolute right-2 top-full mt-1 text-[10px] text-brand-sentinel"
          aria-live="polite"
        >
          Searching…
        </output>
      ) : null}
    </div>
  );
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
