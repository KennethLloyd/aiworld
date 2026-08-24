import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { getFrontendOrigins } from './lib/config/origins';
import { setupOpenApi } from './lib/openapi/openapi';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': [
            "'self'",
            'https://cdn.jsdelivr.net/npm/@scalar/api-reference', // allow better-auth's openapi docs to be rendered
          ],
        },
      },
    }),
  );
  const frontendOrigins = getFrontendOrigins();
  if (frontendOrigins.length > 0) {
    app.enableCors({ origin: frontendOrigins, credentials: true });
  }
  app.setGlobalPrefix('api');
  setupOpenApi(app);
  const port = process.env.PORT ?? 3000;
  await app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}
bootstrap();
