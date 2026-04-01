import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { HaravanService } from '../../haravan/haravan.service';

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

const ORGID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

@Injectable()
export class ShopAuthGuard implements CanActivate {
  constructor(private readonly haravanService: HaravanService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<ShopRequest>();
    const orgid =
      toStringValue(req.headers['orgid']) ||
      toStringValue(req.headers['x-orgid']) ||
      toStringValue(req.query?.orgid) ||
      toStringValue(req.body?.orgid);

    if (!orgid) throw new BadRequestException('Missing orgid');
    if (!ORGID_REGEX.test(orgid))
      throw new BadRequestException('Invalid orgid');

    try {
      req.token = await this.haravanService.resolveAccessToken(orgid);
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
