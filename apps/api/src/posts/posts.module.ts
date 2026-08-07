import { Module } from '@nestjs/common';

import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';
import { PostsController } from '@/posts/posts.controller';
import { PostsService } from '@/posts/posts.service';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { PrismaPostRepository } from '@/posts/repositories/prisma-post.repository';
import { WorldModule } from '@/world/world.module';

@Module({
  imports: [WorldModule],
  controllers: [PostsController],
  providers: [
    {
      provide: PostRepository,
      useClass: PrismaPostRepository,
    },
    PostResponseMapper,
    PostsService,
  ],
})
export class PostsModule {}
