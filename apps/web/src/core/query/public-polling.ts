/** Public observer refresh cadence for read-only snapshots. */
export const PUBLIC_POLL_INTERVAL_MS = 30_000;

/** Poll only while the tab is visible. A hidden tab must not create a second
 * background client that competes with the visible observer or admin session. */
export const POLLING_OPTIONS = {
  refetchIntervalInBackground: false,
} as const;
