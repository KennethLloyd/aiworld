import type { BadgeProps } from './badge';
import { Badge } from './badge';
import { cn } from './cn';
import { identityAccent } from './identity-accent';

export interface IdentityBadgeProps extends Omit<BadgeProps, 'dot' | 'tone'> {
  identityId: string;
}

export function IdentityBadge({
  identityId,
  className,
  ...props
}: IdentityBadgeProps) {
  return (
    <Badge
      {...props}
      tone="info"
      dot={false}
      data-identity-accent={identityAccent(identityId)}
      className={cn('identity-badge', className)}
    />
  );
}
