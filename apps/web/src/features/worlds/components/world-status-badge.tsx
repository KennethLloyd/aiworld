import { Badge } from '@/shared/ui/badge';

/**
 * isActive status pill for a WorldResponse. Tone + dot + text so status is
 * never carried by color alone; public lists only show active worlds, but the
 * badge renders both states for future admin surfaces.
 */
export function WorldStatusBadge({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <Badge tone="success" dot>
      Active
    </Badge>
  ) : (
    <Badge tone="neutral" dot>
      Inactive
    </Badge>
  );
}
