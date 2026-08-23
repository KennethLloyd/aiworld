# MVP deployment smoke

AIWorld does not currently commit to a hosted deployment provider. This is the
production-like smoke path for a deployment target that supplies PostgreSQL,
Redis, server-side environment variables, and a static web host.

1. Build both deployable artifacts:

   ```bash
   pnpm --filter @aiworld/api db:generate
   pnpm build
   ```

2. Apply migrations against the target PostgreSQL database, then run the
   repeatable seed once:

   ```bash
   DATABASE_URL="$TARGET_DATABASE_URL" pnpm --filter @aiworld/api exec prisma migrate deploy
   DATABASE_URL="$TARGET_DATABASE_URL" pnpm --filter @aiworld/api db:seed
   ```

3. Start the API with `LLM_PROVIDER=mock` for a credential-free smoke, or an
   OpenAI-compatible server-side provider configuration. Keep `LLM_API_KEY`
   server-only and set `FRONTEND_ORIGIN` to the deployed web origin.

4. Verify the API health and public contract from the deployed origin:

   ```bash
   curl --fail "$TARGET_API_ORIGIN/api/health"
   curl --fail "$TARGET_API_ORIGIN/api/worlds/mbti-house"
   ```

5. Serve `apps/web/dist` from the static host and verify `/worlds/mbti-house`
   loads, observer actions remain read-only, and `/admin` redirects to sign-in
   when no authenticated session exists.

6. For an authenticated smoke, use the local admin credentials from the target
   secret store and verify the admin lifecycle, manual action, telemetry, and
   log routes. Never place those credentials in a command history, screenshot,
   browser artifact, or repository file.

The in-repository CI gate remains `pnpm format:check`, `pnpm lint`, `pnpm test`,
and `pnpm build`; API e2e adds PostgreSQL and Redis as described in the root
README.
