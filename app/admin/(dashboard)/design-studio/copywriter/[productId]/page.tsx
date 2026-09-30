import { CopyWriterWorkspace } from "@/components/admin-panel/design-studio/CopyWriterWorkspace";

export default async function CopyWriterProductPage({ params, searchParams }: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ locale?: string; filter?: string; q?: string }>;
}) {
  const { productId } = await params;
  const { filter, q } = await searchParams;
  return <CopyWriterWorkspace mode="product" productId={productId} filter={filter} query={q} />;
}
