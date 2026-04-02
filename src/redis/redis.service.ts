import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject('REDIS_CLIENT') private readonly client: Redis) {}

  async set(key: string, value: unknown, ttl?: number) {
    const val = JSON.stringify(value);
    if (ttl) {
      await this.client.set(key, val, 'EX', ttl);
    } else {
      await this.client.set(key, val);
    }
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const val = await this.client.get(key);
    if (!val) return null;
    return JSON.parse(val) as T;
  }

  /** Cursor-based SCAN — non-blocking alternative to KEYS for large keyspaces */
  async scanKeys(pattern: string, batchSize = 100): Promise<string[]> {
    const results: string[] = [];
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        batchSize,
      );
      cursor = nextCursor;
      results.push(...keys);
    } while (cursor !== '0');
    return results;
  }

  async del(key: string): Promise<number> {
    return await this.client.del(key);
  }

  async delMany(keys: string[]): Promise<number> {
    if (!keys.length) return 0;
    return await this.client.del(...keys);
  }

  /** SET key value EX ttl NX — returns true if lock acquired, false if already held */
  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  onModuleDestroy() {
    void this.client.quit();
  }
}
