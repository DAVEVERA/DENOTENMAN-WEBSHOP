import { notFound } from "next/navigation";
import ProductPage, {
  generateMetadata as generateProductMetadata,
} from "../../products/[product]/page";

type ProductPageProps = {
  params: Promise<{ locale: string; product: string }>;
};

export const generateMetadata = generateProductMetadata;

export default async function DutchProductPage(props: ProductPageProps) {
  const { locale } = await props.params;

  if (locale !== "nl") {
    notFound();
  }

  return ProductPage(props);
}
