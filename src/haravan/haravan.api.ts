import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common/exceptions';

type QueryPrimitive = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryPrimitive>;

type MetafieldItem = {
  id?: string | number;
  key?: string;
  value?: unknown;
  value_type?: string;
  [key: string]: unknown;
};

type RecordData = Record<string, unknown>;

type ProductsResponse = RecordData & {
  products?: RecordData[];
};

type ProductResponse = RecordData & {
  product?: RecordData;
};

type MetafieldsResponse = RecordData & {
  metafields?: MetafieldItem[];
};

type MetafieldResponse = RecordData & {
  metafield?: MetafieldItem;
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

const normalizeQueryValue = (value: QueryPrimitive): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const NUMERIC_ID_REGEX = /^\d{1,20}$/;

/** Validate that an ID param is numeric-only (prevents path traversal). */
const assertNumericId = (value: string, label: string): void => {
  if (!NUMERIC_ID_REGEX.test(value)) {
    throw new BadRequestException(`Invalid ${label}: must be numeric`);
  }
};

@Injectable()
export class HaravanAPIService {
  private readonly logger = new Logger(HaravanAPIService.name);
  private readonly client: AxiosInstance;

  // ─── Concurrency limiter (max 6 in-flight requests globally) ───
  private static readonly MAX_CONCURRENT = 6;
  private static readonly MAX_RETRIES = 5;
  private inflightCount = 0;
  private waitQueue: Array<() => void> = [];

  private acquireSlot(): Promise<void> {
    if (this.inflightCount < HaravanAPIService.MAX_CONCURRENT) {
      this.inflightCount++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.waitQueue.push(() => {
        this.inflightCount++;
        resolve();
      });
    });
  }

  private releaseSlot(): void {
    this.inflightCount--;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift()!;
      next();
    }
  }

  /** Execute an axios request with concurrency throttling + 429 retry */
  private async throttledRequest<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquireSlot();
    try {
      return await this.executeWithRetry(fn);
    } finally {
      this.releaseSlot();
    }
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    attempt = 0,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 429 &&
        attempt < HaravanAPIService.MAX_RETRIES
      ) {
        const retryAfter = parseFloat(
          error.response.headers?.['retry-after'] || '2',
        );
        const delay = Math.max(retryAfter, 1) * 1000 + attempt * 500;
        this.logger.warn(
          `Rate limited (429). Retry ${attempt + 1}/${HaravanAPIService.MAX_RETRIES} after ${delay}ms`,
        );
        await new Promise((r) => setTimeout(r, delay));
        return this.executeWithRetry(fn, attempt + 1);
      }
      throw error;
    }
  }

  constructor(private readonly configService: ConfigService) {
    this.client = axios.create({
      baseURL: 'https://apis.haravan.com/com',
      timeout: 15000,
    });
  }

  private buildAxiosErrorDetail(error: unknown, request: RecordData) {
    const axiosError: AxiosError | null = axios.isAxiosError(error)
      ? error
      : null;

    // Redact sensitive fields from request payload
    const safeRequest = { ...request };
    delete safeRequest.token;
    if (safeRequest.payload && typeof safeRequest.payload === 'object') {
      safeRequest.payload = '[REDACTED]';
    }

    return {
      request: safeRequest,
      status: axiosError?.response?.status,
      statusText: axiosError?.response?.statusText,
      responseData: axiosError?.response?.data,
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

  // ─── Product API ───
  async getProducts(
    token: string,
    params: QueryParams = {},
  ): Promise<ProductsResponse> {
    const queryParams = this.buildQueryParams({
      limit: params.limit,
      page: params.page,
      title: params.title,
      fields: params.fields,
    });

    const qs = queryParams.toString();
    const url = `/products.json${qs ? '?' + qs : ''}`;
    const response = await this.throttledRequest(() =>
      this.client.get<ProductsResponse>(url, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!response.data)
      throw new BadRequestException('Failed to fetch products');
    return response.data;
  }

  async getProduct(token: string, productId: string): Promise<RecordData> {
    assertNumericId(productId, 'productId');
    const response = await this.throttledRequest(() =>
      this.client.get<ProductResponse>(`/products/${productId}.json`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!response.data || !response.data.product)
      throw new BadRequestException('Failed to fetch product');
    return response.data.product;
  }

  // ─── Product Metafield API ───
  async getProductMetafields(
    token: string,
    productId: string,
    namespace?: string,
  ): Promise<MetafieldItem[]> {
    assertNumericId(productId, 'productId');
    let url = `/products/${productId}/metafields.json`;
    if (namespace) url += `?namespace=${namespace}`;

    const response = await this.throttledRequest(() =>
      this.client.get<MetafieldsResponse>(url, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!response.data || !response.data.metafields)
      throw new BadRequestException('Failed to fetch product metafields');

    // Haravan ignores namespace filter — filter client-side
    const metafields = response.data.metafields;
    if (namespace) {
      return metafields.filter((m) => m.namespace === namespace);
    }
    return metafields;
  }

  async createProductMetafield(
    token: string,
    productId: string,
    metafield: {
      namespace: string;
      key: string;
      value: string;
      value_type: string;
    },
  ): Promise<MetafieldItem> {
    assertNumericId(productId, 'productId');
    const url = `/products/${productId}/metafields.json`;
    let response: { data: MetafieldResponse };
    try {
      response = await this.throttledRequest(() =>
        this.client.post(
          url,
          { metafield },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    } catch (error: unknown) {
      const detail = this.buildAxiosErrorDetail(error, {
        action: 'createProductMetafield',
        url,
        productId,
        payload: { metafield },
      });
      this.logger.error(
        'Haravan createProductMetafield failed',
        JSON.stringify(detail),
      );
      throw new BadRequestException({
        message: 'Haravan create product metafield failed',
        detail,
      });
    }

    if (!response.data || !response.data.metafield)
      throw new BadRequestException('Failed to create product metafield');
    return response.data.metafield;
  }

  async updateProductMetafield(
    token: string,
    productId: string,
    metafieldId: string,
    metafield: { value: string; value_type?: string },
  ): Promise<MetafieldItem> {
    assertNumericId(productId, 'productId');
    assertNumericId(metafieldId, 'metafieldId');
    const url = `/products/${productId}/metafields/${metafieldId}.json`;
    let response: { data: MetafieldResponse };
    try {
      response = await this.throttledRequest(() =>
        this.client.put(
          url,
          { metafield },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );
    } catch (error: unknown) {
      const detail = this.buildAxiosErrorDetail(error, {
        action: 'updateProductMetafield',
        url,
        productId,
        metafieldId,
        payload: { metafield },
      });
      this.logger.error(
        'Haravan updateProductMetafield failed',
        JSON.stringify(detail),
      );
      throw new BadRequestException({
        message: 'Haravan update product metafield failed',
        detail,
      });
    }

    if (!response.data || !response.data.metafield)
      throw new BadRequestException('Failed to update product metafield');
    return response.data.metafield;
  }

  async deleteProductMetafield(
    token: string,
    productId: string,
    metafieldId: string,
  ): Promise<RecordData> {
    assertNumericId(productId, 'productId');
    assertNumericId(metafieldId, 'metafieldId');
    const response = await this.throttledRequest(() =>
      this.client.delete<RecordData>(
        `/products/${productId}/metafields/${metafieldId}.json`,
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );
    if (!response.data)
      throw new BadRequestException('Failed to delete product metafield');
    return response.data;
  }

  // ─── Metafield API ───
  async getMetafields(
    token: string,
    type: string,
    namespace: string,
    objectid: string,
  ): Promise<MetafieldItem[]> {
    if (type !== 'shop') assertNumericId(objectid, 'objectid');
    const ns = encodeURIComponent(namespace);
    let url = '';
    switch (type) {
      case 'shop':
        url = `/metafields.json?owner_resource=shop&namespace=${ns}`;
        break;
      case 'page':
        url = `/metafields.json?owner_resource=page&owner_id=${objectid}&namespace=${ns}`;
        break;
      default:
        url = `/metafields.json?owner_id=${objectid}&namespace=${ns}`;
        break;
    }

    const response = await this.throttledRequest(() =>
      this.client.get<MetafieldsResponse>(url, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
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

    const ALLOWED_TYPES = ['shop', 'page', 'product'];
    if (!ALLOWED_TYPES.includes(type)) {
      throw new BadRequestException(`Invalid metafield owner type: ${type}`);
    }
    if (type !== 'shop') assertNumericId(objectid, 'objectid');

    let url = '';
    switch (type) {
      case 'shop':
        url = `/metafields.json`;
        break;
      case 'page':
        url = `/metafields.json`;
        break;
      default:
        url = `/${type}s/${objectid}/metafields.json`;
        break;
    }

    let response: { data: MetafieldResponse };
    try {
      response = await this.throttledRequest(() =>
        this.client.post(
          url,
          { metafield },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
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
    assertNumericId(metafieldid, 'metafieldid');
    const normalized = this.normalizeMetafieldPayload(value, value_type);

    const metafield = {
      value: normalized.value,
      value_type: normalized.value_type,
      ...(description && { description }),
    };

    const url = `/metafields/${metafieldid}.json`;

    let response: { data: MetafieldResponse };
    try {
      response = await this.throttledRequest(() =>
        this.client.put(
          url,
          { metafield },
          {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        ),
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
    assertNumericId(metafieldid, 'metafieldid');
    const response = await this.throttledRequest(() =>
      this.client.delete<RecordData>(`/metafields/${metafieldid}.json`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!response.data)
      throw new BadRequestException('Failed to delete metafield');
    return response.data;
  }

  async getShop(token: string): Promise<RecordData> {
    const response = await this.throttledRequest(() =>
      this.client.get<ShopResponse>('/shop.json', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    if (!response.data || !response.data.shop) {
      throw new BadRequestException('Failed to fetch shop info');
    }
    return response.data.shop;
  }
}
