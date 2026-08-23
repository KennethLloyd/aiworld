import { z } from 'zod';

export const adminTabValues = [
  'status',
  'world',
  'characters',
  'members',
  'logs',
] as const;

export const adminDashboardSearchSchema = z.object({
  world: z.string().trim().min(1).max(80).optional(),
  tab: z.enum(adminTabValues).default('status'),
  /** Deep-link to a simulation log from the status tab's recent activity. */
  log: z.string().trim().min(1).optional(),
});

export type AdminDashboardSearch = z.infer<typeof adminDashboardSearchSchema>;

export const adminDashboardDefaults: AdminDashboardSearch =
  adminDashboardSearchSchema.parse({});
