/** Feed/post cadence; static World/Resident snapshots stay manual. */
export const PUBLIC_FEED_POLL_INTERVAL_MS = 5 * 60_000;

/** Keep active polling out of hidden tabs to avoid unnecessary background work. */
export const POLLING_OPTIONS = {
  refetchIntervalInBackground: false,
} as const;
