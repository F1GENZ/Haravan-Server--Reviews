import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from '../redis/redis.service';
import { HaravanService } from './haravan.service';

type AppInstallData = {
  orgid?: string;
  refresh_token?: string;
  status?: string;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return 'Unknown error';
};

@Injectable()
export class HaravanCronService {
  private readonly logger = new Logger(HaravanCronService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly haravanService: HaravanService,
  ) {}

  @Cron(CronExpression.EVERY_12_HOURS)
  async handleCron() {
    this.logger.log('Running token refresh cron...');
    let keys: string[];
    try {
      keys = await this.redisService.scanKeys('haravan:reviews:app_install:*');
    } catch (err) {
      this.logger.error(`Cron failed to fetch keys: ${getErrorMessage(err)}`);
      return;
    }

    for (const key of keys) {
      const appData = await this.redisService.get<AppInstallData>(key);
      if (!appData) continue;

      // Skip inactive
      if (appData.status === 'unactive' || appData.status === 'needs_reinstall')
        continue;

      // Skip if no refresh_token
      if (!appData.refresh_token || !appData.orgid) continue;

      try {
        await this.haravanService.refreshToken(
          appData.orgid,
          appData.refresh_token,
        );
        this.logger.log(`Cron refreshed token for orgid: ${appData.orgid}`);
      } catch (error) {
        this.logger.warn(
          `Cron refresh failed for orgid: ${appData.orgid}: ${getErrorMessage(error)}`,
        );
        // Mark for reinstall
        appData.status = 'needs_reinstall';
        await this.redisService.set(key, appData, 30 * 24 * 60 * 60);
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}
