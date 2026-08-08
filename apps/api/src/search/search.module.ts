import { Module } from '@nestjs/common';

import { CommentsModule } from '@/comments/comments.module';
import { PostsModule } from '@/posts/posts.module';
import { SearchResponseMapper } from '@/search/mappers/search-response.mapper';
import { SearchController } from '@/search/search.controller';
import { SearchService } from '@/search/search.service';
import { WorldModule } from '@/world/world.module';

@Module({
  imports: [WorldModule, PostsModule, CommentsModule],
  controllers: [SearchController],
  providers: [SearchService, SearchResponseMapper],
})
export class SearchModule {}
