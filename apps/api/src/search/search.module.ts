import { Module } from '@nestjs/common';

import { CommentsModule } from '@/comments/comments.module';
import { PostsModule } from '@/posts/posts.module';
import { SearchController } from '@/search/search.controller';
import { SearchService } from '@/search/search.service';
import { WorldModule } from '@/world/world.module';

@Module({
  imports: [WorldModule, PostsModule, CommentsModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
