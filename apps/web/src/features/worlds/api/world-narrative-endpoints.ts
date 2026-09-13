export const worldNarrativeEndpoints = {
  detail(slug: string): string {
    return `/api/worlds/${encodeURIComponent(slug)}/narrative`;
  },
};
