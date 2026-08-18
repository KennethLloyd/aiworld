import { useNavigate, useSearch } from '@tanstack/react-router';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Input } from '@/shared/ui/input';

/** Header search for the public worlds directory. The URL remains canonical. */
export function WorldDirectorySearch() {
  const search = useSearch({ from: '/worlds/' });
  const navigate = useNavigate({ from: '/worlds/' });
  const [draft, setDraft] = useState(search.search ?? '');
  const debouncedDraft = useDebouncedValue(draft, 300);

  useEffect(() => {
    setDraft(search.search ?? '');
  }, [search.search]);

  useEffect(() => {
    if (debouncedDraft === (search.search ?? '')) {
      return;
    }
    void navigate({
      search: (previous) => ({
        ...previous,
        search: debouncedDraft === '' ? undefined : debouncedDraft,
        page: 1,
      }),
    });
  }, [debouncedDraft, navigate, search.search]);

  return (
    <div className="relative w-full">
      <Input
        aria-label="Search worlds"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Search by name or topic..."
        autoComplete="off"
        className="!h-[38px] !bg-glass-50 pl-10 pr-3 shadow-inner"
      />
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40"
      />
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
