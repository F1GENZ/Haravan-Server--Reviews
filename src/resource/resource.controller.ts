import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { HaravanAPIService } from '../haravan/haravan.api';
import { ShopAuth } from '../common/decorators/shop-auth.decorator';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';

type QueryParams = Record<string, string | number | boolean | undefined>;

@Controller('resources')
export class ResourceController {
  constructor(private readonly haravanAPI: HaravanAPIService) {}

  @UseGuards(ShopAuthGuard)
  @Get('collections')
  async getCollections(@ShopAuth() token: string, @Query() query: QueryParams) {
    return {
      success: true,
      data: await this.haravanAPI.getCollections(token, query),
    };
  }

  @UseGuards(ShopAuthGuard)
  @Get('products')
  async getProducts(@ShopAuth() token: string, @Query() query: QueryParams) {
    return {
      success: true,
      data: await this.haravanAPI.getProducts(token, query),
    };
  }

  @UseGuards(ShopAuthGuard)
  @Get('blogs')
  async getBlogs(@ShopAuth() token: string) {
    return {
      success: true,
      data: await this.haravanAPI.getBlogs(token),
    };
  }

  @UseGuards(ShopAuthGuard)
  @Get('blogs/:blogId/articles')
  async getArticles(
    @ShopAuth() token: string,
    @Param('blogId') blogId: string,
    @Query() query: QueryParams,
  ) {
    return {
      success: true,
      data: await this.haravanAPI.getArticles(token, blogId, query),
    };
  }

  @UseGuards(ShopAuthGuard)
  @Get('pages')
  async getPages(@ShopAuth() token: string, @Query() query: QueryParams) {
    return {
      success: true,
      data: await this.haravanAPI.getPages(token, query),
    };
  }

  @UseGuards(ShopAuthGuard)
  @Get('link-lists')
  async getLinkLists(@Query('domain') domain: string) {
    return {
      success: true,
      data: await this.haravanAPI.getLinkListsByDomain(domain),
    };
  }
}
