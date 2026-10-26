import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OpenAPIPageProvider } from "@/components/docs-openapi-page";
import { DocsPageActions } from "@/components/docs-page-actions";
import {
  DOCS_GITHUB_REF,
  DOCS_REPOSITORY,
  docsGithubEditPath,
  docsPageSocialMetadata,
} from "@/lib/docs-social";
import { docsSource } from "@/lib/docs-source";
import { openapi } from "@/lib/public-openapi-server";
import { getMDXComponents } from "@/mdx-components";

type DocsPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export default async function Page({ params }: DocsPageProps) {
  const page = docsSource.getPage((await params).slug);
  if (!page) notFound();

  const Mdx = page.data.body;
  const lastUpdate = exportedLastModified(page.data);
  if (!lastUpdate) {
    throw new Error(`Docs page ${page.url} is missing a last-updated date.`);
  }
  const preloaded =
    page.data._openapi === undefined
      ? undefined
      : await openapi.preloadOpenAPIPage(page);

  return (
    <DocsPage
      editOnGithub={{
        owner: DOCS_REPOSITORY.owner,
        path: docsGithubEditPath(page.path),
        repo: DOCS_REPOSITORY.repo,
        sha: DOCS_GITHUB_REF,
      }}
      full={page.data.full}
      lastUpdate={lastUpdate}
      toc={page.data.toc}
    >
      <DocsPageActions pageUrl={page.url} />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <OpenAPIPageProvider value={preloaded}>
          <Mdx components={getMDXComponents()} />
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

  return docsPageSocialMetadata({
    description: page.data.description,
    title: page.data.title,
    url: page.url,
  });
}

function exportedLastModified(data: object): Date | undefined {
  if (!("lastModified" in data)) return undefined;
  const value: unknown = data.lastModified;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  return undefined;
}
