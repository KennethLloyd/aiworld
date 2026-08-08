import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from '@thallesp/nestjs-better-auth';

import { ActivityModule } from '@/activity/activity.module';
import { CharactersModule } from '@/characters/characters.module';
import { CommentsModule } from '@/comments/comments.module';
import { PostsModule } from '@/posts/posts.module';
import { WorldMembersModule } from '@/world-members/world-members.module';
import { WorldModule } from '@/world/world.module';

import { AppController } from './app.controller';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { createAuth } from './lib/auth/auth';
import { PrismaModule } from './lib/database/prisma.module';
import { PrismaService } from './lib/database/prisma.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuthModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({ auth: createAuth(prisma) }),
    }),
    WorldModule,
    CharactersModule,
    WorldMembersModule,
    PostsModule,
    CommentsModule,
    ActivityModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
