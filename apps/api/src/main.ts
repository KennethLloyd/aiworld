import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { appConfig } from './lib/config/environment';
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
  const frontendOrigins = appConfig.frontendOrigins;
  if (frontendOrigins.length > 0) {
    app.enableCors({ origin: frontendOrigins, credentials: true });
  }
  app.setGlobalPrefix('api');
  setupOpenApi(app);
  await app.listen(appConfig.apiPort, () => {
    console.log(`Server is running on ${appConfig.apiOrigin}`);
  });
}
bootstrap();
