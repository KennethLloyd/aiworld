import { Module } from '@nestjs/common';

import { CommentsModule } from '@/comments/comments.module';
import { PostsController } from '@/posts/posts.controller';
import { PostsService } from '@/posts/posts.service';
import { WorldModule } from '@/world/world.module';

// CommentsModule imports nothing, so this cannot create a cycle.
// If it ever needs PostsModule, rework this import.
@Module({
  imports: [WorldModule, CommentsModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
