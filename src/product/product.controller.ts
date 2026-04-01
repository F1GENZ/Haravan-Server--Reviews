import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ShopAuthGuard } from '../common/guards/shop-auth.guard';
import { ProductService } from './product.service';
import { NumericIdPipe } from '../common/pipes/numeric-id.pipe';
import { GetProductsQueryDto } from './dto/get-products-query.dto';

type AuthRequest = {
  token?: string;
  orgid?: string;
};

@Controller('products')
@UseGuards(ShopAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async getProducts(
    @Query() query: GetProductsQueryDto,
    @Req() req: AuthRequest,
  ) {
    if (!req.token) throw new BadRequestException('Missing auth');
    const data = await this.productService.getProducts(req.token, query);
    return { data };
  }

  @Get(':productId')
  async getProduct(
    @Param('productId', NumericIdPipe) productId: string,
    @Req() req: AuthRequest,
  ) {
    if (!req.token) throw new BadRequestException('Missing auth');
    const data = await this.productService.getProduct(req.token, productId);
    return { data };
  }
}
