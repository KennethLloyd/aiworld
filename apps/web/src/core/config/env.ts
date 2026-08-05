import { z } from 'zod';

/**
 * VITE_* variables are public by definition (they are bundled into the
 * client): no secrets ever belong here. Only VITE_API_BASE_URL is read. In
 * development it is empty and the Vite dev server proxies /api/* to the API
 * origin, so requests stay same-origin and the session cookie flows without
 * CORS involvement.
 */
const envSchema = z.object({
  VITE_API_BASE_URL: z.url().optional(),
});

const parsedEnv = envSchema.safeParse(import.meta.env);

export const env = {
  apiBaseUrl: parsedEnv.success ? (parsedEnv.data.VITE_API_BASE_URL ?? '') : '',
};
