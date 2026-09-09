import { CopyWriterWorkspace } from "@/components/admin-panel/design-studio/CopyWriterWorkspace";

export default async function CopyWriterProductPage({ params, searchParams }: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { productId } = await params;
  await searchParams;
  return <CopyWriterWorkspace mode="product" productId={productId} />;
}
