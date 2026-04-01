import { Module } from '@nestjs/common';
import { StorefrontAssetController } from './storefront-asset.controller';

@Module({
  controllers: [StorefrontAssetController],
})
export class StorefrontModule {}
