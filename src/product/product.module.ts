import { Module } from '@nestjs/common';
import { HaravanModule } from '../haravan/haravan.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [HaravanModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
