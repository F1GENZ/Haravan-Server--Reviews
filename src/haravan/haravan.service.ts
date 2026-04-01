import {
  BadRequestException,
  UnauthorizedException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { HaravanAPIService } from './haravan.api';
import axios from 'axios';
import * as crypto from 'crypto';
import type { Request, Response } from 'express';

const REDIS_PREFIX = 'haravan:reviews:app_install';

type HaravanConfig = {
  frontEndUrl: string;
  urlAuthorize: string;
  urlConnectToken: string;
  clientId: string;
  clientSecret: string;
  loginCallbackUrl: string;
  installCallbackUrl: string;
  scopeLogin: string;
  scopeInstall: string;
  grantTypeInstall: string;
  grantTypeRefresh: string;
  responseType: string;
  nonce: string;
};

type RedisInstallData = {
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: number;
  orgid?: string;
  orgsub?: string;
  status?: string;
  expires_at?: number;
  installed_at?: number;
};

type OAuthTokenPayload = {
  id_token?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

const asString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value;
  return null;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

const decodeJwtClaims = (idToken: string): Record<string, unknown> => {
  const parts = idToken.split('.');
  if (parts.length < 2) {
    throw new BadRequestException('Invalid id_token format');
  }

  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');

  const normalized = payload.padEnd(Math.ceil(payload.length / 4) * 4, '=');
  const decodedText = Buffer.from(normalized, 'base64').toString('utf8');
  const decoded: unknown = JSON.parse(decodedText);

  if (typeof decoded !== 'object' || decoded === null) {
    throw new BadRequestException('Invalid id_token payload');
  }

  return decoded as Record<string, unknown>;
};

@Injectable()
export class HaravanService {
  private readonly logger = new Logger(HaravanService.name);
  private static readonly SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
  private static readonly REFRESH_WINDOW_MS = 30 * 60 * 1000;

  constructor(
    private readonly config: ConfigService,
    private readonly redisService: RedisService,
    private readonly haravanAPI: HaravanAPIService,
  ) {}

  private getHaravanConfig(): HaravanConfig {
    return {
      frontEndUrl: this.config.get<string>('FRONTEND_URL') || '',
      urlAuthorize: this.config.get<string>('HRV_URL_AUTHORIZE') || '',
      urlConnectToken: this.config.get<string>('HRV_URL_CONNECT_TOKEN') || '',
      clientId: this.config.get<string>('HRV_CLIENT_ID') || '',
      clientSecret: this.config.get<string>('HRV_CLIENT_SECRET') || '',
      loginCallbackUrl: this.config.get<string>('HRV_LOGIN_CALLBACK_URL') || '',
      installCallbackUrl:
        this.config.get<string>('HRV_INSTALL_CALLBACK_URL') || '',
      scopeLogin: this.config.get<string>('HRV_SCOPE_LOGIN') || '',
      scopeInstall: this.config.get<string>('HRV_SCOPE_INSTALL') || '',
      grantTypeInstall: this.config.get<string>('HRV_GRANT_TYPE_INSTALL') || '',
      grantTypeRefresh: this.config.get<string>('HRV_GRANT_TYPE_REFRESH') || '',
      responseType: this.config.get<string>('HRV_RESPONSE_TYPE') || '',
      nonce: this.config.get<string>('HRV_NONCE') || '',
    };
  }

  private sessionKey(orgid: string): string {
    return `${REDIS_PREFIX}:${orgid}`;
  }

  private async getInstallSession(
    orgid: string,
  ): Promise<RedisInstallData | null> {
    return this.redisService.get<RedisInstallData>(this.sessionKey(orgid));
  }

  async resolveAccessToken(orgid: string): Promise<string> {
    const session = await this.getInstallSession(orgid);
    if (!session?.access_token) {
      throw new UnauthorizedException('Session expired, please login again');
    }

    if (session.status === 'needs_reinstall' || session.status === 'unactive') {
      this.logger.warn(`App status ${session.status} for orgid: ${orgid}`);
      throw new UnauthorizedException('App needs reinstall. Please login again.');
    }

    const now = Date.now();
    const tokenExpiresAt =
      typeof session.token_expires_at === 'number'
        ? session.token_expires_at
        : null;
    const needsRefresh =
      !tokenExpiresAt ||
      tokenExpiresAt - now < HaravanService.REFRESH_WINDOW_MS;

    if (needsRefresh && session.refresh_token) {
      const lockKey = `lock:token_refresh:${orgid}`;
      const lockAcquired = await this.redisService.setNx(lockKey, '1', 30);

      if (lockAcquired) {
        try {
          const newToken = await this.refreshToken(orgid, session.refresh_token);
          if (newToken) return newToken;
        } catch (refreshError) {
          this.logger.warn(
            `Failed to refresh token for orgid ${orgid}: ${getErrorMessage(refreshError)}`,
          );
        } finally {
          await this.redisService.del(lockKey);
        }
      } else {
        const freshData = await this.getInstallSession(orgid);
        const freshExpiry =
          typeof freshData?.token_expires_at === 'number'
            ? freshData.token_expires_at
            : null;
        if (
          freshData?.access_token &&
          (!freshExpiry || freshExpiry > Date.now())
        ) {
          return freshData.access_token;
        }
      }
    }

    if (tokenExpiresAt && tokenExpiresAt <= now) {
      throw new UnauthorizedException('Session expired, please login again');
    }

    return session.access_token;
  }

  // ─── HMAC Verification (Haravan Admin app launch) ───

  /**
   * When a user opens the app from Haravan Admin, Haravan appends
   * ?orgid=...&shop=...&timestamp=...&hmac=... to the URL.
   *
   * IMPORTANT: Haravan computes HMAC using the ORIGINAL param order
   * (not sorted like Shopify). We must preserve the raw query string.
   */
  async verifyHmac(
    rawQueryString: string,
  ): Promise<{ valid: boolean; orgid?: string; reason?: string }> {
    const params = new URLSearchParams(rawQueryString);
    const hmac = params.get('hmac');
    if (!hmac) return { valid: false, reason: 'Missing hmac' };

    const orgid = params.get('orgid');
    if (!orgid) return { valid: false, reason: 'Missing orgid' };

    const c = this.getHaravanConfig();

    // Rebuild query string WITHOUT hmac, preserving original order
    const parts: string[] = [];
    for (const [key, value] of params.entries()) {
      if (key === 'hmac') continue;
      parts.push(`${key}=${value}`);
    }
    const message = parts.join('&');

    const computed = crypto
      .createHmac('sha256', c.clientSecret)
      .update(message)
      .digest('hex');

    if (computed.length !== hmac.length) {
      this.logger.warn(`HMAC length mismatch for orgid: ${orgid}`);
      return { valid: false, reason: 'HMAC mismatch' };
    }

    if (
      !crypto.timingSafeEqual(
        Buffer.from(computed, 'hex'),
        Buffer.from(hmac, 'hex'),
      )
    ) {
      this.logger.warn(`HMAC mismatch for orgid: ${orgid}`);
      return { valid: false, reason: 'HMAC mismatch' };
    }

    // Check timestamp freshness (reject if > 5 minutes old)
    const timestamp = parseInt(params.get('timestamp') || '0', 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > 300) {
      this.logger.warn(`HMAC timestamp expired for orgid: ${orgid}`);
      return { valid: false, reason: 'Timestamp expired' };
    }

    const appData = await this.getInstallSession(orgid);

    if (!appData || !appData.access_token) {
      this.logger.log(`HMAC valid but app not installed for orgid: ${orgid}`);
      return { valid: false, reason: 'App not installed' };
    }

    if (appData.status === 'needs_reinstall' || appData.status === 'unactive') {
      this.logger.log(`HMAC valid but app status: ${appData.status}`);
      return { valid: false, reason: `App status: ${appData.status}` };
    }

    if (appData.refresh_token) {
      try {
        await this.refreshToken(orgid, appData.refresh_token);
      } catch (e) {
        this.logger.warn(
          `Auto-refresh on HMAC login failed: ${getErrorMessage(e)}`,
        );
      }
    }

    this.logger.log(`HMAC verified, auto-login orgid: ${orgid}`);
    return { valid: true, orgid };
  }

  // ─── Build OAuth URLs ───

  private buildUrlInstall(): string {
    const c = this.getHaravanConfig();
    const params = new URLSearchParams({
      response_type: c.responseType,
      scope: c.scopeInstall,
      client_id: c.clientId,
      redirect_uri: c.installCallbackUrl,
      response_mode: 'query',
      nonce: c.nonce,
    });
    return `${c.urlAuthorize}?${params.toString()}`;
  }

  private buildUrlLogin(): string {
    const c = this.getHaravanConfig();
    const params = new URLSearchParams({
      response_type: c.responseType,
      scope: c.scopeLogin,
      client_id: c.clientId,
      redirect_uri: c.loginCallbackUrl,
      response_mode: 'query',
      nonce: c.nonce,
    });
    return `${c.urlAuthorize}?${params.toString()}`;
  }

  // ─── Login Flow ───

  async loginApp(orgid?: string | string[]): Promise<string> {
    const rawOrgid = Array.isArray(orgid)
      ? orgid.find((o) => o && o !== 'null' && o !== 'undefined' && o !== '')
      : orgid;

    if (
      !rawOrgid ||
      rawOrgid === 'null' ||
      rawOrgid === 'undefined' ||
      rawOrgid === ''
    ) {
      return this.buildUrlLogin();
    }

    const cleanOrgid = rawOrgid.replace(/[^a-zA-Z0-9_-]/g, '');
    try {
      const appData = await this.redisService.get<RedisInstallData>(
        `${REDIS_PREFIX}:${cleanOrgid}`,
      );

      this.logger.log(
        `Redis check orgid: ${cleanOrgid} exists: ${!!appData} status: ${appData?.status}`,
      );

      if (!appData) {
        return this.buildUrlLogin();
      }

      if (
        appData.status === 'needs_reinstall' ||
        appData.status === 'unactive'
      ) {
        this.logger.log(`App status ${appData.status}, redirecting to install`);
        return this.buildUrlInstall();
      }

      // App is installed — still require OAuth SSO to prove identity
      return this.buildUrlLogin();
    } catch (error) {
      this.logger.error(`Login error: ${getErrorMessage(error)}`);
      return this.buildUrlLogin();
    }
  }

  // ─── Login Callback ───

  async processLoginCallback(
    code: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    if (!code) throw new BadRequestException('Missing Code');

    const c = this.getHaravanConfig();
    const params = new URLSearchParams({
      code,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: c.loginCallbackUrl,
    });

    try {
      this.logger.log('Exchanging login code...');
      const response = await axios.post<OAuthTokenPayload>(
        c.urlConnectToken,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      const { id_token } = response.data;
      if (!id_token) throw new Error('No id_token returned');

      const decoded = decodeJwtClaims(id_token);
      const orgid = asString(decoded.orgid);
      if (!orgid) throw new BadRequestException('Missing orgid in id_token');
      this.logger.log(`Login callback orgid: ${orgid}`);

      const exists = await this.redisService.has(this.sessionKey(orgid));
      const acceptHeader =
        typeof req.headers?.accept === 'string' ? req.headers.accept : '';

      if (exists) {
        // Refresh token if available
        const appData = await this.getInstallSession(orgid);
        if (appData?.refresh_token) {
          try {
            await this.refreshToken(orgid, appData.refresh_token);
          } catch (e) {
            this.logger.warn(`Auto-refresh failed: ${getErrorMessage(e)}`);
          }
        }

        const frontendUrl = `${c.frontEndUrl}?orgid=${orgid}`;
        if (acceptHeader.includes('application/json')) {
          res.json({ url: frontendUrl });
          return;
        }
        res.redirect(frontendUrl);
        return;
      } else {
        // Not installed → redirect to Install
        const installUrl = this.buildUrlInstall();
        if (acceptHeader.includes('application/json')) {
          res.json({ url: installUrl });
          return;
        }
        res.redirect(installUrl);
        return;
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      this.logger.error(`Login callback error: ${errorMessage}`);
      const acceptHeader =
        typeof req.headers?.accept === 'string' ? req.headers.accept : '';
      if (acceptHeader.includes('application/json')) {
        res.status(400).json({ error: errorMessage });
        return;
      }
      res.redirect(
        `${c.frontEndUrl}/error?message=${encodeURIComponent(errorMessage)}`,
      );
      return;
    }
  }

  // ─── Install Flow ───

  async installApp(code: string, res: Response): Promise<string> {
    if (!code) throw new BadRequestException('Missing Code');

    const c = this.getHaravanConfig();
    const params = new URLSearchParams({
      code,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: c.grantTypeInstall,
      redirect_uri: c.installCallbackUrl,
    });

    try {
      const response = await axios.post<OAuthTokenPayload>(
        c.urlConnectToken,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (!response.data) throw new BadRequestException();
      const { id_token, access_token, expires_in, refresh_token } =
        response.data;
      if (!id_token || !access_token || !expires_in) {
        throw new BadRequestException('Invalid OAuth token payload');
      }

      const decoded = decodeJwtClaims(id_token);
      const orgid = asString(decoded.orgid);
      const orgsub = asString(decoded.orgsub) || undefined;
      if (!orgid) throw new BadRequestException('Missing orgid in id_token');
      this.logger.log(`Install orgid: ${orgid} orgsub: ${orgsub}`);

      const existingApp = await this.getInstallSession(orgid);

      const tokenExpiresAt = Date.now() + expires_in * 1000;

      const tokenData = {
        access_token,
        refresh_token: refresh_token || undefined,
        token_expires_at: tokenExpiresAt,
        orgid,
        orgsub,
        status: existingApp ? existingApp.status : 'trial',
        expires_at: existingApp
          ? existingApp.expires_at
          : Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days trial
        installed_at: existingApp?.installed_at || Date.now(),
      };

      await this.redisService.set(
        this.sessionKey(orgid),
        tokenData,
        HaravanService.SESSION_TTL_SECONDS,
      );

      this.logger.log(`App installed for orgid: ${orgid}`);

      // Write storefront config metafield (for Liquid snippets)
      this.writeStorefrontConfig(access_token, orgid).catch((e) =>
        this.logger.warn(
          `Failed to write storefront config: ${getErrorMessage(e)}`,
        ),
      );

      res.redirect(
        `${c.frontEndUrl}/install/login?orgid=${encodeURIComponent(orgid)}&installed=1`,
      );
    } catch (error) {
      this.logger.error(`Install error: ${getErrorMessage(error)}`);
      res.redirect(`${c.frontEndUrl}/install/login?error=install_failed`);
    }
    return `Install status for code ${code}`;
  }

  // ─── Token Refresh ───

  async refreshToken(
    orgid: string,
    old_refresh_token: string,
  ): Promise<string> {
    if (!old_refresh_token) throw new UnauthorizedException('No Refresh Token');

    const c = this.getHaravanConfig();
    const params = new URLSearchParams({
      refresh_token: old_refresh_token,
      client_id: c.clientId,
      client_secret: c.clientSecret,
      grant_type: c.grantTypeRefresh,
    });

    try {
      const response = await axios.post<OAuthTokenPayload>(
        c.urlConnectToken,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      );

      if (!response.data) throw new BadRequestException();
      const { access_token, expires_in, refresh_token } = response.data;
      if (!access_token || !expires_in) {
        throw new BadRequestException('Invalid refresh token payload');
      }
      const tokenExpiresAt = Date.now() + expires_in * 1000;

      const existsApp = await this.getInstallSession(orgid);

      if (existsApp) {
        existsApp.access_token = access_token;
        existsApp.refresh_token = refresh_token || existsApp.refresh_token;
        existsApp.token_expires_at = tokenExpiresAt;
        await this.redisService.set(
          this.sessionKey(orgid),
          existsApp,
          HaravanService.SESSION_TTL_SECONDS,
        );
      } else {
        await this.redisService.set(
          this.sessionKey(orgid),
          {
            access_token,
            refresh_token: refresh_token || undefined,
            token_expires_at: tokenExpiresAt,
          },
          HaravanService.SESSION_TTL_SECONDS,
        );
      }

      this.logger.log(
        `Token refreshed for orgid=${orgid}, expires in ${expires_in}s`,
      );
      return access_token;
    } catch (error) {
      this.logger.error(`Token refresh error: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  // ─── Storefront Config Metafield ───

  /**
   * Write f1genz.config shop metafield with apiUrl and orgid.
   * Liquid snippets read: shop.metafields.f1genz.config.value.apiUrl
   */
  private async writeStorefrontConfig(
    token: string,
    orgid: string,
  ): Promise<void> {
    const apiUrl = this.config.get<string>('API_URL') || '';
    if (!apiUrl) {
      this.logger.warn('API_URL not set — skipping storefront config write');
      return;
    }

    const configValue = JSON.stringify({ apiUrl, orgid });
    const MF_NS = 'f1genz';
    const MF_KEY = 'config';

    // Check if metafield already exists
    const metafields = await this.haravanAPI.getMetafields(
      token,
      'shop',
      MF_NS,
      '',
    );
    const existing = metafields
      .filter((m) => m.namespace === MF_NS)
      .find((m) => m.key === MF_KEY);

    if (existing?.id) {
      await this.haravanAPI.updateMetafield(token, {
        metafieldid: String(existing.id),
        value: configValue,
        value_type: 'json',
      });
    } else {
      await this.haravanAPI.createMetafield(token, {
        type: 'shop',
        objectid: '',
        namespace: MF_NS,
        key: MF_KEY,
        value: configValue,
        value_type: 'json',
      });
    }

    this.logger.log(`Storefront config metafield written for orgid: ${orgid}`);
  }
}
