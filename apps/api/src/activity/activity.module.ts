import { Module } from '@nestjs/common';

import { ActivityController } from '@/activity/activity.controller';
import { ActivityService } from '@/activity/activity.service';
import { ActivityResponseMapper } from '@/activity/mappers/activity-response.mapper';
import { CharactersModule } from '@/characters/characters.module';
import { CommentsModule } from '@/comments/comments.module';
import { PostsModule } from '@/posts/posts.module';
import { WorldMembersModule } from '@/world-members/world-members.module';
import { WorldModule } from '@/world/world.module';

@Module({
  imports: [
    WorldModule,
    CharactersModule,
    WorldMembersModule,
    PostsModule,
    CommentsModule,
  ],
  controllers: [ActivityController],
  providers: [ActivityService, ActivityResponseMapper],
})
export class ActivityModule {}
