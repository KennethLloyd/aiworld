import { z } from 'zod';

/**
 * VITE_* variables are public by definition (they are bundled into the
 * client): no secrets ever belong here. VITE_API_BASE_URL is an optional
 * deployment override. In local development it stays empty, so requests hit
 * the same-origin /api path through the Vite proxy and session cookies remain
 * same-origin.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z.url().optional(),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

export const env = {
  apiBaseUrl: parsedEnv.success ? (parsedEnv.data.VITE_API_BASE_URL ?? '') : '',
};
