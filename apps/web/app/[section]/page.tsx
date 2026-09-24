import { notFound } from 'next/navigation';
import { ProductWorkspace } from '../product-workspace';
import { isWorkspaceSection, workspaceSections } from '../workspace-sections';

// All workspace routes are declared below; reject unknown segments before streaming.
export const dynamicParams = false;

export function generateStaticParams() {
  return workspaceSections.map((section) => ({ section }));
}

export default async function WorkspaceSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isWorkspaceSection(section)) notFound();
  return <ProductWorkspace initialTab={section} />;
}
