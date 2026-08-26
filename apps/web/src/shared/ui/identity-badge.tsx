import type { BadgeProps } from './badge';
import { Badge } from './badge';
import { cn } from './cn';
import { identityAccent } from './identity-accent';

export interface IdentityBadgeProps extends Omit<BadgeProps, 'dot' | 'tone'> {
  identity: string;
}

export function IdentityBadge({
  identity,
  className,
  ...props
}: IdentityBadgeProps) {
  return (
    <Badge
      {...props}
      tone="info"
      dot={false}
      data-identity-accent={identityAccent(identity)}
      className={cn('identity-badge', className)}
    />
  );
}
