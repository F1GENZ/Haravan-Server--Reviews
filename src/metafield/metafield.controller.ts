import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  Param,
  UseGuards,
} from '@nestjs/common';
import { MetafieldService } from './metafield.service';
import { ShopAuth } from '../common/decorators/shop-auth.decorator';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';

type SaveSettingsBody = {
  settings: unknown;
  metafieldId?: string;
};

type SetTemplateBody = {
  template: string;
};

type QueryParams = Record<string, string | number | boolean | undefined>;

@Controller('pages')
export class MetafieldController {
  constructor(private readonly metafieldService: MetafieldService) {}

  // List all pages
  @UseGuards(ShopAuthGuard)
  @Get()
  async getPages(@ShopAuth() token: string, @Query() query: QueryParams) {
    return {
      success: true,
      data: await this.metafieldService.getPages(token, query),
    };
  }

  // Get page settings (metafield fxpage/settings)
  @UseGuards(ShopAuthGuard)
  @Get(':pageId/settings')
  async getPageSettings(
    @ShopAuth() token: string,
    @Param('pageId') pageId: string,
  ) {
    return {
      success: true,
      data: await this.metafieldService.getPageSettings(token, pageId),
    };
  }

  // Save page settings
  @UseGuards(ShopAuthGuard)
  @Put(':pageId/settings')
  async savePageSettings(
    @ShopAuth() token: string,
    @Param('pageId') pageId: string,
    @Body() body: SaveSettingsBody,
  ) {
    return {
      success: true,
      data: await this.metafieldService.savePageSettings(token, pageId, body),
    };
  }

  // Get page template (fxpage/template metafield)
  @UseGuards(ShopAuthGuard)
  @Get(':pageId/template')
  async getPageTemplate(
    @ShopAuth() token: string,
    @Param('pageId') pageId: string,
  ) {
    return {
      success: true,
      data: await this.metafieldService.getPageTemplate(token, pageId),
    };
  }

  // Set page template
  @UseGuards(ShopAuthGuard)
  @Put(':pageId/template')
  async setPageTemplate(
    @ShopAuth() token: string,
    @Param('pageId') pageId: string,
    @Body() body: SetTemplateBody,
  ) {
    return {
      success: true,
      data: await this.metafieldService.setPageTemplate(
        token,
        pageId,
        body.template,
      ),
    };
  }
}
