import { Injectable, Logger } from '@nestjs/common';
import { HaravanAPIService } from '../haravan/haravan.api';
import { RedisService } from '../redis/redis.service';

type ThemeItem = {
  id?: string | number;
  role?: string;
};

type AssetItem = {
  key?: string;
  size?: number;
  updated_at?: string;
  value?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Cache active theme ID for 5 minutes to avoid hitting Haravan API on every request */
const THEME_ID_CACHE_TTL = 300;

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(
    private readonly haravanAPI: HaravanAPIService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get the active/main theme ID, cached in Redis for 5 minutes.
   * Each `orgid` stores its own cache key.
   */
  private async getActiveThemeId(
    token: string,
    orgid: string,
  ): Promise<string | null> {
    const cacheKey = `haravan:multipage:active_theme_id:${orgid}`;

    try {
      const cached = await this.redis.get<string>(cacheKey);
      if (cached) return cached;
    } catch { /* ignore Redis errors — fall through to API */ }

    try {
      const themes = (await this.haravanAPI.getThemes(token)) as ThemeItem[];
      const mainTheme = themes.find((theme) => theme.role === 'main');
      const themeId = mainTheme?.id?.toString() || null;

      if (themeId) {
        try {
          await this.redis.set(cacheKey, themeId, THEME_ID_CACHE_TTL);
        } catch { /* ignore Redis write errors */ }
      }

      return themeId;
    } catch (error) {
      this.logger.error(
        `Failed to find active theme: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }

  // List all fxpage template handles from theme assets
  async getTemplates(
    token: string,
    orgid: string,
  ): Promise<
    Array<{ handle: string; key: string; size?: number; updated_at?: string }>
  > {
    const themeId = await this.getActiveThemeId(token, orgid);
    if (!themeId) return [];

    const assets = (await this.haravanAPI.getAssets(
      token,
      themeId,
    )) as AssetItem[];

    const fxpageAssets = assets.filter((asset) => {
      const key = asset.key || '';
      return key.includes('page.fxpage.') && key.endsWith('.json');
    });

    return fxpageAssets.map((asset) => {
      const key = asset.key || '';
      const match = key.match(/page\.fxpage\.(.+)\.json$/);
      return {
        handle: match ? match[1] : key,
        key,
        size: asset.size,
        updated_at: asset.updated_at,
      };
    });
  }

  // Get the full JSON schema for a template handle
  async getTemplateSchema(
    token: string,
    orgid: string,
    handle: string,
  ): Promise<unknown> {
    const themeId = await this.getActiveThemeId(token, orgid);
    if (!themeId) return null;

    // Strip "page.fxpage." prefix if handle already contains it
    const cleanHandle = handle.replace(/^page\.fxpage\./, '');
    const assetKey = `assets/page.fxpage.${cleanHandle}.json`;

    try {
      const asset = (await this.haravanAPI.getAsset(
        token,
        themeId,
        assetKey,
      )) as AssetItem;
      if (!asset || !asset.value) return null;

      try {
        const parsed: unknown = JSON.parse(asset.value);
        if (isRecord(parsed) && 'schema' in parsed) {
          return parsed.schema;
        }
        return parsed;
      } catch {
        this.logger.warn(`Invalid JSON in template ${handle}`);
        return asset.value;
      }
    } catch (error) {
      this.logger.warn(
        `Template schema not found: ${handle}: ${getErrorMessage(error)}`,
      );
      return null;
    }
  }
}
