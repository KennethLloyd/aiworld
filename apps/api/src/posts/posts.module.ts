import { Module } from '@nestjs/common';

import { CommentsModule } from '@/comments/comments.module';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';
import { PostsController } from '@/posts/posts.controller';
import { PostsService } from '@/posts/posts.service';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { PrismaPostRepository } from '@/posts/repositories/prisma-post.repository';
import { WorldModule } from '@/world/world.module';

// CommentsModule is a leaf module (it imports nothing and never imports
// PostsModule), so importing it here cannot create a dependency cycle. The
// import stays only as long as the post detail read composes comment data;
// if CommentsModule ever needs PostsModule, this edge must be reworked.
@Module({
  imports: [WorldModule, CommentsModule],
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
