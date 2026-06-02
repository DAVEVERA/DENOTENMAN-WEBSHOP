type ProductPriceProps = {
  price: string;
};

export function ProductPrice({ price }: ProductPriceProps) {
  return <strong className="product-detail-price">{price}</strong>;
}