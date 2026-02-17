import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { HaravanService } from '../../haravan/haravan.service';
import { RedisService } from '../../redis/redis.service';

type TokenSession = {
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number;
  status?: string;
};

type ShopRequest = Request<
  Record<string, string>,
  unknown,
  Record<string, unknown>,
  Record<string, unknown>
> & {
  token?: string;
  orgid?: string;
};

const toStringValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value;
  if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
    return value[0];
  }
  return null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

@Injectable()
export class ShopAuthGuard implements CanActivate {
  private readonly logger = new Logger(ShopAuthGuard.name);

  constructor(
    private readonly redis: RedisService,
    private readonly haravanService: HaravanService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ShopRequest>();
    const orgid =
      toStringValue(req.headers['orgid']) ||
      toStringValue(req.headers['x-orgid']) ||
      toStringValue(req.query?.orgid) ||
      toStringValue(req.body?.orgid);

    if (!orgid) throw new BadRequestException('Missing orgid');

    try {
      const tokenData = await this.redis.get<TokenSession>(
        `haravan:multipage:app_install:${orgid}`,
      );

      if (!tokenData || !tokenData.access_token) {
        throw new UnauthorizedException('Session expired, please login again');
      }

      // Check if app needs reinstall
      if (tokenData.status === 'needs_reinstall') {
        this.logger.warn(`App needs reinstall for orgid: ${orgid}`);
        throw new UnauthorizedException(
          'App needs reinstall. Please login again.',
        );
      }

      // Auto-refresh token if expires within 30 minutes
      const THIRTY_MINUTES = 30 * 60 * 1000;
      const now = Date.now();
      const tokenExpiresAt =
        typeof tokenData.token_expires_at === 'number'
          ? tokenData.token_expires_at
          : null;
      const needsRefresh =
        !tokenExpiresAt || tokenExpiresAt - now < THIRTY_MINUTES;

      if (needsRefresh && tokenData.refresh_token) {
        this.logger.log(`Token needs refresh for orgid: ${orgid}`);
        try {
          const newTokenCandidate = await this.haravanService.refreshToken(
            orgid,
            tokenData.refresh_token,
          );
          const newToken =
            typeof newTokenCandidate === 'string' ? newTokenCandidate : null;
          if (newToken) {
            req.token = newToken;
            req.orgid = orgid;
            this.logger.log(`Token refreshed for orgid: ${orgid}`);
            return true;
          }
        } catch (refreshError) {
          this.logger.warn(
            `Failed to refresh token for orgid: ${orgid}: ${getErrorMessage(refreshError)}`,
          );
        }
      }

      req.token = tokenData.access_token;
      req.orgid = orgid;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Session expired, please login again');
    }
    return true;
  }
}
