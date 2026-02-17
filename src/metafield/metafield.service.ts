import { Injectable, Logger } from '@nestjs/common';
import { HaravanAPIService } from '../haravan/haravan.api';

type QueryParams = Record<string, string | number | boolean | undefined>;

type MetafieldItem = {
  id?: string | number;
  key?: string;
  value?: unknown;
  value_type?: string;
};

type SaveSettingsBody = {
  settings: unknown;
  metafieldId?: string;
};

type ErrorDetail = {
  status?: number;
  responseData?: unknown;
  [key: string]: unknown;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractWrappedDetail = (error: unknown): ErrorDetail | null => {
  if (!isObject(error)) return null;
  const maybeResponse = error.response;
  if (isObject(maybeResponse) && isObject(maybeResponse.detail)) {
    return maybeResponse.detail as ErrorDetail;
  }

  const maybeGetResponse: unknown = error.getResponse;
  if (typeof maybeGetResponse === 'function') {
    const response = (maybeGetResponse as () => unknown)();
    if (isObject(response) && isObject(response.detail)) {
      return response.detail as ErrorDetail;
    }
  }

  return null;
};

const extractErrorStatus = (
  error: unknown,
  detail: ErrorDetail | null,
): number | null => {
  if (typeof detail?.status === 'number') return detail.status;
  if (
    isObject(error) &&
    isObject(error.response) &&
    typeof error.response.status === 'number'
  ) {
    return error.response.status;
  }
  if (isObject(error) && typeof error.status === 'number') return error.status;
  return null;
};

const extractErrorText = (
  error: unknown,
  detail: ErrorDetail | null,
): string => {
  const responseData = detail?.responseData;
  if (responseData !== undefined) return JSON.stringify(responseData);
  if (isObject(error) && isObject(error.response) && 'data' in error.response) {
    return JSON.stringify(error.response.data);
  }
  if (detail) return JSON.stringify(detail);
  return '{}';
};

@Injectable()
export class MetafieldService {
  private readonly logger = new Logger(MetafieldService.name);

  constructor(private readonly haravanAPI: HaravanAPIService) {}

  // List pages
  async getPages(token: string, params: QueryParams = {}) {
    return await this.haravanAPI.getPages(token, params);
  }

  // Get page settings from metafield (namespace: fxpage, key: settings)
  async getPageSettings(token: string, pageId: string) {
    try {
      const metafields = await this.haravanAPI.getMetafields(
        token,
        'page',
        'fxpage',
        pageId,
      );

      const settingsMetafield = (metafields as MetafieldItem[]).find(
        (metafield) => metafield.key === 'settings',
      );

      if (!settingsMetafield) {
        return { settings: null, metafieldId: null };
      }

      let parsedValue = settingsMetafield.value;
      if (typeof parsedValue === 'string') {
        try {
          parsedValue = JSON.parse(parsedValue);
        } catch {
          // keep as string
        }
      }

      return {
        settings: parsedValue,
        metafieldId: settingsMetafield.id,
        valueType: settingsMetafield.value_type,
      };
    } catch (error) {
      this.logger.warn(
        `No settings found for page ${pageId}: ${getErrorMessage(error)}`,
      );
      return { settings: null, metafieldId: null, valueType: null };
    }
  }

  // Save page settings to metafield
  async savePageSettings(
    token: string,
    pageId: string,
    body: SaveSettingsBody,
  ) {
    const { settings, metafieldId } = body;

    if (metafieldId) {
      try {
        return await this.haravanAPI.updateMetafield(token, {
          metafieldid: String(metafieldId),
          value: settings,
          value_type: 'json',
        });
      } catch (error: unknown) {
        const wrappedDetail = extractWrappedDetail(error);

        this.logger.error(
          `savePageSettings update failed for page ${pageId}`,
          JSON.stringify(wrappedDetail || getErrorMessage(error)),
        );

        const status = extractErrorStatus(error, wrappedDetail);
        const errorText = extractErrorText(error, wrappedDetail);
        const shouldRecreateAsJson =
          status === 422 &&
          /value_type is not included in the list/i.test(errorText);

        if (!shouldRecreateAsJson) {
          throw error;
        }

        await this.haravanAPI.deleteMetafield(token, metafieldId);

        return await this.haravanAPI.createMetafield(token, {
          type: 'page',
          objectid: pageId,
          namespace: 'fxpage',
          key: 'settings',
          value: settings,
          value_type: 'json',
        });
      }
    } else {
      // Create new metafield
      return await this.haravanAPI.createMetafield(token, {
        type: 'page',
        objectid: pageId,
        namespace: 'fxpage',
        key: 'settings',
        value: settings,
        value_type: 'json',
      });
    }
  }

  // Get page template name from metafield
  async getPageTemplate(token: string, pageId: string) {
    try {
      const metafields = await this.haravanAPI.getMetafields(
        token,
        'page',
        'fxpage',
        pageId,
      );
      const templateMetafield = (metafields as MetafieldItem[]).find(
        (metafield) => metafield.key === 'template',
      );
      return {
        template: templateMetafield?.value || null,
        metafieldId: templateMetafield?.id || null,
      };
    } catch {
      return { template: null, metafieldId: null };
    }
  }

  // Set page template name
  async setPageTemplate(token: string, pageId: string, template: string) {
    const existing = await this.getPageTemplate(token, pageId);

    if (existing.metafieldId) {
      return await this.haravanAPI.updateMetafield(token, {
        metafieldid: String(existing.metafieldId),
        value: template,
        value_type: 'string',
      });
    } else {
      return await this.haravanAPI.createMetafield(token, {
        type: 'page',
        objectid: pageId,
        namespace: 'fxpage',
        key: 'template',
        value: template,
        value_type: 'string',
      });
    }
  }
}
