import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TemplateService } from './template.service';
import { ShopAuth, ShopOrgId } from '../common/decorators/shop-auth.decorator';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';

@Controller('templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  // GET /api/templates
  @UseGuards(ShopAuthGuard)
  @Get()
  async getTemplates(@ShopAuth() token: string, @ShopOrgId() orgid: string) {
    return {
      success: true,
      data: await this.templateService.getTemplates(token, orgid),
    };
  }

  // GET /api/templates/page.fxpage.collection
  @UseGuards(ShopAuthGuard)
  @Get(':handle')
  async getTemplateSchema(
    @ShopAuth() token: string,
    @ShopOrgId() orgid: string,
    @Param('handle') handle: string,
  ) {
    return {
      success: true,
      data: await this.templateService.getTemplateSchema(token, orgid, handle),
    };
  }
}
