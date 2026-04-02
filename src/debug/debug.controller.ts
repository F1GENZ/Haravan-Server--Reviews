import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';
import { HaravanAPIService } from '../haravan/haravan.api';
import * as crypto from 'crypto';
import { NumericIdPipe } from '../common/pipes/numeric-id.pipe';

type AuthRequest = {
  token?: string;
  orgid?: string;
};

/** Only show namespaces belonging to this app */
const APP_NAMESPACES = new Set(['reviews', 'qna', 'f1genz']);

@Controller('debug')
export class DebugController {
  constructor(
    private readonly haravanAPI: HaravanAPIService,
    private readonly config: ConfigService,
  ) {}

  /** POST /api/debug/verify — verify debug password server-side */
  @Post('verify')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async verifyDebugPassword(@Body('password') password: string) {
    const expected = this.config.get<string>('DEBUG_PASSWORD');
    if (!expected) {
      throw new BadRequestException('Debug endpoints are disabled');
    }
    const HMAC_KEY = 'debug-verify';
    const a = crypto.createHmac('sha256', HMAC_KEY).update(password ?? '').digest();
    const b = crypto.createHmac('sha256', HMAC_KEY).update(expected).digest();
    if (!crypto.timingSafeEqual(a, b)) {
      return { data: { valid: false } };
    }
    return { data: { valid: true } };
  }

  @UseGuards(ShopAuthGuard)

  /** GET /api/debug/metafields/:productId — raw metafields for a product */
  @Get('metafields/:productId')
  async getProductMetafields(
    @Param('productId', NumericIdPipe) productId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.token) throw new BadRequestException('Missing auth');

    const allMetafields = await this.haravanAPI.getProductMetafields(
      req.token,
      productId,
    );

    // Group by namespace
    const grouped: Record<
      string,
      Array<{
        id: unknown;
        key: string;
        value_type: string;
        value_raw: string;
        value_parsed: unknown;
        value_length: number;
      }>
    > = {};

    for (const mf of allMetafields) {
      const ns = String(mf.namespace || '_unknown');
      if (!APP_NAMESPACES.has(ns)) continue;
      if (!grouped[ns]) grouped[ns] = [];

      let parsed: unknown = null;
      const raw = String(mf.value ?? '');
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }

      grouped[ns].push({
        id: mf.id,
        key: String(mf.key),
        value_type: String(mf.value_type || 'unknown'),
        value_raw: raw,
        value_parsed: parsed,
        value_length: raw.length,
      });
    }

    // Sort keys within each namespace
    for (const ns of Object.keys(grouped)) {
      grouped[ns].sort((a, b) => a.key.localeCompare(b.key));
    }

    const filteredTotal = Object.values(grouped).reduce(
      (s, m) => s + m.length,
      0,
    );

    return {
      data: {
        productId,
        totalMetafields: filteredTotal,
        namespaces: grouped,
      },
    };
  }

  /** GET /api/debug/shop-metafields — all shop-level metafields */
  @UseGuards(ShopAuthGuard)
  @Get('shop-metafields')
  async getShopMetafields(@Req() req: AuthRequest) {
    if (!req.token) throw new BadRequestException('Missing auth');

    const allMetafields = await this.haravanAPI.getMetafields(
      req.token,
      'shop',
      '',
      '',
    );

    const grouped: Record<
      string,
      Array<{
        id: unknown;
        key: string;
        value_type: string;
        value_raw: string;
        value_parsed: unknown;
        value_length: number;
      }>
    > = {};

    for (const mf of allMetafields) {
      const ns = String(mf.namespace || '_unknown');
      if (!APP_NAMESPACES.has(ns)) continue;
      if (!grouped[ns]) grouped[ns] = [];

      let parsed: unknown = null;
      const raw = String(mf.value ?? '');
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = raw;
      }

      grouped[ns].push({
        id: mf.id,
        key: String(mf.key),
        value_type: String(mf.value_type || 'unknown'),
        value_raw: raw,
        value_parsed: parsed,
        value_length: raw.length,
      });
    }

    for (const ns of Object.keys(grouped)) {
      grouped[ns].sort((a, b) => a.key.localeCompare(b.key));
    }

    const filteredTotal = Object.values(grouped).reduce(
      (s, m) => s + m.length,
      0,
    );

    return {
      data: {
        totalMetafields: filteredTotal,
        namespaces: grouped,
      },
    };
  }
}
