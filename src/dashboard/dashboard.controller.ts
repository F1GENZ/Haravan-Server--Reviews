import {
  Controller,
  Get,
  Post,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';
import { DashboardService } from './dashboard.service';
import { RedisService } from '../redis/redis.service';

type AuthRequest = {
  token?: string;
  orgid?: string;
};

@Controller('dashboard')
@UseGuards(ShopAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly redis: RedisService,
  ) {}

  @Get('overview')
  async getOverview(@Req() req: AuthRequest) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const data = await this.dashboardService.getOverview(req.token, req.orgid);
    return { data };
  }

  @Post('rebuild-stats')
  async rebuildStats(@Req() req: AuthRequest) {
    if (!req.token || !req.orgid) throw new BadRequestException('Missing auth');
    const data = await this.dashboardService.rebuildStats(req.token, req.orgid);
    return { data };
  }

  @Get('shop-info')
  async getShopInfo(@Req() req: AuthRequest) {
    if (!req.orgid) throw new BadRequestException('Missing auth');
    const installData = await this.redis.get<{
      orgid?: string;
      orgsub?: string;
      status?: string;
      expires_at?: number;
      installed_at?: number;
    }>(`haravan:reviews:app_install:${req.orgid}`);

    return {
      data: {
        orgid: req.orgid,
        orgsub: installData?.orgsub || null,
        status: installData?.status || 'unknown',
        expires_at: installData?.expires_at || null,
        installed_at: installData?.installed_at || null,
      },
    };
  }
}
