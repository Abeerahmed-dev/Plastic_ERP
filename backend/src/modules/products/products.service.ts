import { NotFoundError } from '../../shared/errors';
import { CreateProductInput, UpdateProductInput, ProductQuery } from './products.schemas';
import * as productsRepo from './products.repository';
import { PaginationMeta } from '../../shared/apiResponse';

export async function listProducts(query: ProductQuery): Promise<{
  data: productsRepo.ProductWithStock[];
  meta: PaginationMeta;
}> {
  const { rows, total } = await productsRepo.findAllProducts(query);
  return {
    data: rows,
    meta: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
}

export async function listPOSAvailableProducts(search?: string): Promise<productsRepo.ProductWithStock[]> {
  return productsRepo.findPOSAvailableProducts(search);
}

export async function getProduct(id: string): Promise<productsRepo.ProductWithStock> {
  const product = await productsRepo.findProductById(id);
  if (!product) throw new NotFoundError('Product');
  return product;
}

export async function addProduct(
  data: CreateProductInput,
  createdBy: string,
): Promise<productsRepo.ProductWithStock> {
  return productsRepo.createProduct(data, createdBy);
}

export async function editProduct(
  id: string,
  data: UpdateProductInput,
): Promise<productsRepo.ProductWithStock> {
  await getProduct(id);
  const updated = await productsRepo.updateProduct(id, data);
  if (!updated) throw new NotFoundError('Product');
  return updated;
}

export async function deactivateProduct(id: string): Promise<void> {
  await getProduct(id);
  await productsRepo.softDeleteProduct(id);
}

export async function getProductBatches(productId: string) {
  return productsRepo.getAvailableBatches(productId);
}
