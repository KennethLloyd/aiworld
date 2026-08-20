import type {
  AdminCharacterGateway,
  CharacterGateway,
} from '@/features/characters/api/character-gateway';

export const unusedCharacterGateway: CharacterGateway = {
  list: async () => {
    throw new Error('unused test adapter');
  },
  getById: async () => {
    throw new Error('unused test adapter');
  },
  getActivity: async () => {
    throw new Error('unused test adapter');
  },
};

export const unusedAdminCharacterGateway: AdminCharacterGateway = {
  listAdmin: async () => {
    throw new Error('unused test adapter');
  },
  getAdminById: async () => {
    throw new Error('unused test adapter');
  },
  create: async () => {
    throw new Error('unused test adapter');
  },
  update: async () => {
    throw new Error('unused test adapter');
  },
};
