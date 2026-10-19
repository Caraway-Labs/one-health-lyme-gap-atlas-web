import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  OpenAPIPage,
  OpenAPIPageProvider,
} from "@/components/docs-openapi-page";
import { docsCanonicalUrl } from "@/lib/docs-config";
import { docsSource } from "@/lib/docs-source";
import { openapi } from "@/lib/public-openapi-server";

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function Page({ params }: DocsPageProps) {
  const page = docsSource.getPage((await params).slug);
  if (!page) notFound();

  const Mdx = page.data.body;
  const preloaded =
    page.data._openapi === undefined
      ? undefined
      : await openapi.preloadOpenAPIPage(page);

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <OpenAPIPageProvider value={preloaded}>
          <Mdx components={{ OpenAPIPage }} />
        </OpenAPIPageProvider>
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return docsSource.generateParams();
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const page = docsSource.getPage((await params).slug);
  if (!page) notFound();

  return {
    alternates: { canonical: docsCanonicalUrl(page.url) },
    description: page.data.description,
    title: `${page.data.title} | Atlas documentation`,
  };
}
