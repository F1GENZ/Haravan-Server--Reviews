import { Controller, Get, Logger, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';
import { ShopAuth, ShopOrgId } from '../common/decorators/shop-auth.decorator';
import { RedisService } from '../redis/redis.service';
import { HaravanAPIService } from '../haravan/haravan.api';

type RedisInstallData = {
  orgsub?: string;
};

type ShopData = {
  domain?: string;
  primary_domain?: string;
  myharavan_domain?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

@Controller('shop')
export class ShopController {
  private readonly logger = new Logger(ShopController.name);

  constructor(
    private readonly redis: RedisService,
    private readonly haravanAPI: HaravanAPIService,
  ) {}

  @UseGuards(ShopAuthGuard)
  @Get()
  async getShopInfo(@ShopAuth() token: string, @ShopOrgId() orgid: string) {
    const tokenData = await this.redis.get<RedisInstallData>(
      `haravan:multipage:app_install:${orgid}`,
    );
    const orgsub = tokenData?.orgsub || '';

    let domain = orgsub ? `${orgsub}.myharavan.com` : '';

    try {
      const shop = (await this.haravanAPI.getShop(token)) as ShopData;
      const customDomain = shop.domain || shop.primary_domain || '';
      const myHaravanDomain = shop.myharavan_domain || domain;
      domain = customDomain || myHaravanDomain;
    } catch (error) {
      this.logger.warn(`Failed to fetch shop info: ${getErrorMessage(error)}`);
    }

    return {
      success: true,
      data: { orgid, orgsub, domain },
    };
  }

  // Proxy preview — fetch page HTML, strip X-Frame-Options
  @UseGuards(ShopAuthGuard)
  @Get('preview')
  async proxyPreview(
    @ShopOrgId() orgid: string,
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    if (!url) {
      return res.status(400).send('Missing url param');
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        redirect: 'follow',
      });

      let html = await response.text();

      // Rewrite relative URLs to absolute
      const baseUrl = new URL(url);
      const base = `${baseUrl.protocol}//${baseUrl.host}`;

      // Inject <base> tag so relative assets load correctly
      html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${base}/">`);

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      // Explicitly allow framing
      res.removeHeader('X-Frame-Options');
      res.setHeader('Content-Security-Policy', 'frame-ancestors *');
      res.send(html);
    } catch (error) {
      res.status(502).send('Failed to load preview: ' + getErrorMessage(error));
    }
  }
}
