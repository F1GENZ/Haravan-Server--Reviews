import { Injectable, Logger } from '@nestjs/common';
import { HaravanAPIService } from '../haravan/haravan.api';

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

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  constructor(private readonly haravanAPI: HaravanAPIService) {}

  // Get the active/main theme ID
  private async getActiveThemeId(token: string): Promise<string | null> {
    try {
      const themes = (await this.haravanAPI.getThemes(token)) as ThemeItem[];
      const mainTheme = themes.find((theme) => theme.role === 'main');
      return mainTheme?.id?.toString() || null;
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
  ): Promise<
    Array<{ handle: string; key: string; size?: number; updated_at?: string }>
  > {
    const themeId = await this.getActiveThemeId(token);
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
  async getTemplateSchema(token: string, handle: string): Promise<unknown> {
    const themeId = await this.getActiveThemeId(token);
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
