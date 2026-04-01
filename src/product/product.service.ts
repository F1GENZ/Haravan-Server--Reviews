import { Injectable } from '@nestjs/common';
import { HaravanAPIService } from '../haravan/haravan.api';
import { GetProductsQueryDto } from './dto/get-products-query.dto';

@Injectable()
export class ProductService {
  constructor(private readonly haravanAPI: HaravanAPIService) {}

  async getProducts(token: string, params: GetProductsQueryDto = {}) {
    return this.haravanAPI.getProducts(token, params as Record<string, string>);
  }

  async getProduct(token: string, productId: string) {
    return this.haravanAPI.getProduct(token, productId);
  }
}
