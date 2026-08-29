import {
  simulationActionTypes,
  simulationExecutionSources,
} from '@aiworld/shared/schemas/simulation-command.schema';
import { simulationLogStatuses } from '@aiworld/shared/schemas/simulation-log.schema';
import { z } from 'zod';

export const adminTabValues = [
  // `status`, `world`, and `members` remain valid aliases for existing
  // bookmarks. The scoped shell uses the clearer names below.
  'status',
  'overview',
  'world',
  'simulation',
  'characters',
  'members',
  'residents',
  'logs',
  'settings',
] as const;

export const adminDashboardSearchSchema = z.object({
  world: z.string().trim().min(1).max(80).optional(),
  tab: z.enum(adminTabValues).default('status'),
  /** Deep-link to a simulation log from the status tab's recent activity. */
  log: z.string().trim().min(1).optional(),
  logCharacterId: z.uuid().optional(),
  logAction: z.enum(simulationActionTypes).optional(),
  logStatus: z.enum(simulationLogStatuses).optional(),
  logSource: z.enum(simulationExecutionSources).optional(),
  logPage: z.coerce.number().int().min(1).optional(),
});

export type AdminDashboardSearch = z.infer<typeof adminDashboardSearchSchema>;

export const adminDashboardDefaults: AdminDashboardSearch =
  adminDashboardSearchSchema.parse({});
