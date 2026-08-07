import { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';
import type { SearchQuery } from '@aiworld/shared/schemas/search.schema';
import { searchQuerySchema } from '@aiworld/shared/schemas/search.schema';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { ZodValidationPipe } from '@/common/pipes';
import { SearchResponseMapper } from '@/search/mappers/search-response.mapper';
import { SearchService } from '@/search/search.service';

@Controller('worlds/:slug/search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly searchResponseMapper: SearchResponseMapper,
  ) {}

  @Get()
  @AllowAnonymous()
  async search(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(searchQuerySchema)) query: SearchQuery,
  ): Promise<SearchResponse> {
    const results = await this.searchService.search(slug, query);

    if (!results) {
      throw new NotFoundException();
    }

    return this.searchResponseMapper.mapToSearchResponse(results);
  }
}
