import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common/exceptions';

type QueryPrimitive = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryPrimitive>;

type ThemeItem = {
  id?: string | number;
  role?: string;
  [key: string]: unknown;
};

type AssetItem = {
  key?: string;
  value?: string;
  size?: number;
  updated_at?: string;
  [key: string]: unknown;
};

type MetafieldItem = {
  id?: string | number;
  key?: string;
  value?: unknown;
  value_type?: string;
  [key: string]: unknown;
};

type RecordData = Record<string, unknown>;

type PagesResponse = RecordData & {
  pages?: unknown[];
};

type PageResponse = RecordData & {
  page?: RecordData;
};

type MetafieldsResponse = RecordData & {
  metafields?: MetafieldItem[];
};

type MetafieldResponse = RecordData & {
  metafield?: MetafieldItem;
};

type ThemesResponse = RecordData & {
  themes?: ThemeItem[];
};

type AssetsResponse = RecordData & {
  assets?: AssetItem[];
};

type ShopResponse = RecordData & {
  shop?: RecordData;
};

type MetafieldInput = {
  type: string;
  objectid: string;
  namespace: string;
  key: string;
  value: unknown;
  value_type?: string;
  description?: string;
};

type UpdateMetafieldInput = {
  metafieldid: string;
  value: unknown;
  value_type?: string;
  description?: string;
};

const isRecord = (value: unknown): value is RecordData =>
  typeof value === 'object' && value !== null;

const normalizeQueryValue = (value: QueryPrimitive): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

@Injectable()
export class HaravanAPIService {
  private readonly logger = new Logger(HaravanAPIService.name);

  constructor(private readonly configService: ConfigService) {}

  private buildAxiosErrorDetail(error: unknown, request: RecordData) {
    const axiosError: AxiosError | null = axios.isAxiosError(error)
      ? error
      : null;

    return {
      request,
      status: axiosError?.response?.status,
      statusText: axiosError?.response?.statusText,
      responseData: axiosError?.response?.data,
      responseHeaders: axiosError?.response?.headers,
      message:
        axiosError?.message ||
        (error instanceof Error ? error.message : 'Unknown error'),
    };
  }

  private normalizeMetafieldPayload(value: unknown, value_type?: string) {
    const requestedType = String(value_type || 'string').trim();
    const isJsonType = requestedType.toLowerCase() === 'json';

    if (!isJsonType) {
      return {
        value,
        value_type: requestedType,
      };
    }

    return {
      value: typeof value === 'string' ? value : JSON.stringify(value ?? {}),
      value_type: 'json',
    };
  }

  private buildQueryParams(params: QueryParams = {}): URLSearchParams {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      const normalized = normalizeQueryValue(value);
      if (normalized !== null) queryParams.append(key, normalized);
    });
    return queryParams;
  }

  // ─── Page API ───
  async getPages(
    token: string,
    params: QueryParams = {},
  ): Promise<PagesResponse> {
    const queryParams = this.buildQueryParams({
      limit: params.limit,
      page: params.page,
      fields: params.fields,
    });

    const url = `https://apis.haravan.com/web/pages.json${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await axios.get<PagesResponse>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.data) throw new BadRequestException('Failed to fetch pages');
    return response.data;
  }

  async getPage(token: string, pageId: string): Promise<RecordData> {
    const response = await axios.get<PageResponse>(
      `https://apis.haravan.com/web/pages/${pageId}.json`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.data || !response.data.page)
      throw new BadRequestException('Failed to fetch page');
    return response.data.page;
  }

  // ─── Metafield API ───
  async getMetafields(
    token: string,
    type: string,
    namespace: string,
    objectid: string,
  ): Promise<MetafieldItem[]> {
    let url = '';
    switch (type) {
      case 'shop':
        url = `https://apis.haravan.com/com/metafields.json?owner_resource=shop&namespace=${namespace}`;
        break;
      case 'page':
        url = `https://apis.haravan.com/com/metafields.json?owner_resource=page&owner_id=${objectid}&namespace=${namespace}`;
        break;
      default:
        url = `https://apis.haravan.com/com/metafields.json?owner_id=${objectid}&namespace=${namespace}`;
        break;
    }

    const response = await axios.get<MetafieldsResponse>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.data || !response.data.metafields)
      throw new BadRequestException('Failed to fetch metafields');
    return response.data.metafields;
  }

  async createMetafield(
    token: string,
    values: MetafieldInput,
  ): Promise<MetafieldItem> {
    const { type, objectid, namespace, key, value, value_type, description } =
      values;
    const normalized = this.normalizeMetafieldPayload(value, value_type);

    const metafield = {
      namespace,
      key,
      value: normalized.value,
      value_type: normalized.value_type,
      ...(description && { description }),
      ...(type === 'page' && {
        owner_resource: 'page',
        owner_id: Number(objectid),
      }),
    };

    let url = '';
    switch (type) {
      case 'shop':
        url = `https://apis.haravan.com/com/metafields.json`;
        break;
      case 'page':
        url = `https://apis.haravan.com/com/metafields.json`;
        break;
      default:
        url = `https://apis.haravan.com/com/${type}s/${objectid}/metafields.json`;
        break;
    }

    let response: { data: MetafieldResponse };
    try {
      response = await axios.post(
        url,
        { metafield },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error: unknown) {
      const detail = this.buildAxiosErrorDetail(error, {
        action: 'createMetafield',
        url,
        type,
        objectid,
        payload: { metafield },
      });
      this.logger.error(
        'Haravan createMetafield failed',
        JSON.stringify(detail),
      );
      throw new BadRequestException({
        message: 'Haravan create metafield failed',
        detail,
      });
    }

    if (!response.data || !response.data.metafield)
      throw new BadRequestException('Failed to create metafield');
    return response.data.metafield;
  }

  async updateMetafield(
    token: string,
    values: UpdateMetafieldInput,
  ): Promise<MetafieldItem> {
    const { metafieldid, value, value_type, description } = values;
    const normalized = this.normalizeMetafieldPayload(value, value_type);

    const metafield = {
      value: normalized.value,
      value_type: normalized.value_type,
      ...(description && { description }),
    };

    const url = `https://apis.haravan.com/com/metafields/${metafieldid}.json`;

    let response: { data: MetafieldResponse };
    try {
      response = await axios.put(
        url,
        { metafield },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
    } catch (error: unknown) {
      const detail = this.buildAxiosErrorDetail(error, {
        action: 'updateMetafield',
        url,
        metafieldid,
        payload: { metafield },
      });
      this.logger.error(
        'Haravan updateMetafield failed',
        JSON.stringify(detail),
      );
      throw new BadRequestException({
        message: 'Haravan update metafield failed',
        detail,
      });
    }

    if (!response.data || !response.data.metafield)
      throw new BadRequestException('Failed to update metafield');
    return response.data.metafield;
  }

  async deleteMetafield(
    token: string,
    metafieldid: string,
  ): Promise<RecordData> {
    const response = await axios.delete<RecordData>(
      `https://apis.haravan.com/com/metafields/${metafieldid}.json`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.data)
      throw new BadRequestException('Failed to delete metafield');
    return response.data;
  }

  // ─── Theme / Asset API ───
  async getThemes(token: string): Promise<ThemeItem[]> {
    try {
      const response = await axios.get<ThemesResponse>(
        'https://apis.haravan.com/web/themes.json',
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.data || !response.data.themes)
        throw new BadRequestException('Failed to fetch themes');
      return response.data.themes;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new UnauthorizedException('Token expired or invalid');
      }
      throw error;
    }
  }

  async getAsset(
    token: string,
    themeId: string,
    assetKey: string,
  ): Promise<AssetItem> {
    const url = `https://apis.haravan.com/web/themes/${themeId}/assets.json?asset[key]=${assetKey}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401)
        throw new UnauthorizedException('Token expired or invalid');
      throw new BadRequestException('Failed to fetch asset: ' + res.status);
    }
    const data: unknown = await res.json();
    if (!isRecord(data) || !isRecord(data.asset))
      throw new BadRequestException('Failed to fetch asset');
    return data.asset as AssetItem;
  }

  async getAssets(token: string, themeId: string): Promise<AssetItem[]> {
    try {
      const response = await axios.get<AssetsResponse>(
        `https://apis.haravan.com/web/themes/${themeId}/assets.json`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.data || !response.data.assets)
        throw new BadRequestException('Failed to fetch assets');
      return response.data.assets;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new UnauthorizedException('Token expired or invalid');
      }
      throw error;
    }
  }

  async getShop(token: string): Promise<RecordData> {
    const response = await axios.get<ShopResponse>(
      'https://apis.haravan.com/com/shop.json',
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!response.data || !response.data.shop) {
      throw new BadRequestException('Failed to fetch shop info');
    }
    return response.data.shop;
  }

  async getLinkListsByDomain(domain: string): Promise<unknown> {
    const normalizedDomain = String(domain || '')
      .trim()
      .replace(/^https?:\/\//, '');
    if (!normalizedDomain) {
      throw new BadRequestException('Missing shop domain');
    }

    const url = `https://${normalizedDomain}/search?view=fxpage`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new BadRequestException(
        `Failed to fetch link lists from domain: ${response.status}`,
      );
    }

    const raw = await response.text();
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed;
    } catch {
      throw new BadRequestException('Invalid link list JSON response');
    }
  }

  // ─── Resource Search APIs ───
  async getCollections(
    token: string,
    params: QueryParams = {},
  ): Promise<RecordData> {
    const queryParams = this.buildQueryParams({
      limit: params.limit,
      page: params.page,
      title: params.title,
    });

    const url = `https://apis.haravan.com/com/custom_collections.json${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await axios.get<RecordData>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.data)
      throw new BadRequestException('Failed to fetch collections');
    return response.data;
  }

  async getProducts(
    token: string,
    params: QueryParams = {},
  ): Promise<RecordData> {
    const queryParams = this.buildQueryParams({
      limit: params.limit,
      page: params.page,
      title: params.title,
    });

    const url = `https://apis.haravan.com/com/products.json${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await axios.get<RecordData>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.data)
      throw new BadRequestException('Failed to fetch products');
    return response.data;
  }

  async getBlogs(token: string): Promise<RecordData> {
    const response = await axios.get<RecordData>(
      'https://apis.haravan.com/web/blogs.json',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.data) throw new BadRequestException('Failed to fetch blogs');
    return response.data;
  }

  async getArticles(
    token: string,
    blogId: string,
    params: QueryParams = {},
  ): Promise<RecordData> {
    const queryParams = this.buildQueryParams({
      limit: params.limit,
      page: params.page,
    });

    const url = `https://apis.haravan.com/web/blogs/${blogId}/articles.json${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await axios.get<RecordData>(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.data)
      throw new BadRequestException('Failed to fetch articles');
    return response.data;
  }
}
