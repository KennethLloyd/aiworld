import type { AdminGateway } from '@/features/admin/api/admin-gateway';

export const unusedAdminGateway: AdminGateway = {
  getSimulation: async () => {
    throw new Error('unused test adapter');
  },
  updateSimulationState: async () => {
    throw new Error('unused test adapter');
  },
  updateSimulationSpeed: async () => {
    throw new Error('unused test adapter');
  },
  runOneAction: async () => {
    throw new Error('unused test adapter');
  },
  runCustomAction: async () => {
    throw new Error('unused test adapter');
  },
  getSimulationTelemetry: async () => {
    throw new Error('unused test adapter');
  },
  getSimulationHealth: async () => {
    throw new Error('unused test adapter');
  },
  listSimulationLogs: async () => {
    throw new Error('unused test adapter');
  },
};
