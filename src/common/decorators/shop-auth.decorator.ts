import { createParamDecorator, ExecutionContext } from '@nestjs/common';

type ShopAuthRequest = {
  token?: string;
  orgid?: string;
};

export const ShopAuth = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<ShopAuthRequest>();
    return request.token;
  },
);

export const ShopOrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<ShopAuthRequest>();
    return request.orgid;
  },
);
