import type { WorldMemberGateway } from '@/features/admin/api/world-member-gateway';

export const unusedWorldMemberGateway: WorldMemberGateway = {
  list: async () => {
    throw new Error('unused test adapter');
  },
  create: async () => {
    throw new Error('unused test adapter');
  },
  update: async () => {
    throw new Error('unused test adapter');
  },
};
