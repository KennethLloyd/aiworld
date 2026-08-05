import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) registration never fires; register it explicitly.
afterEach(() => {
  cleanup();
});

// TanStack Router restores scroll after navigation; jsdom does not implement
// the browser's scrollTo API, so provide the no-op used by the test runtime.
window.scrollTo = () => {};
