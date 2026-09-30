import { CopyWriterWorkspace } from "@/components/admin-panel/design-studio/CopyWriterWorkspace";

export default async function CopyWriterPage({ searchParams }: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const { filter, q } = await searchParams;
  return <CopyWriterWorkspace mode="overview" filter={filter} query={q} />;
}
