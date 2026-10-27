import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";

import { Mermaid } from "@/components/docs-mermaid";
import { OpenAPIPage } from "@/components/docs-openapi-page";
import { GlossaryList, Term } from "@/features/docs/term";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

/**
 * Fumadocs heading anchors append "Copy Anchor Link" to the accessible name.
 * Existing guides keep a plain heading so those names stay stable.
 */
function plainHeading(tag: HeadingTag) {
  function Heading(props: ComponentProps<"h2">) {
    const Tag = tag;
    return <Tag {...props} />;
  }
  Heading.displayName = `Docs${tag}`;
  return Heading;
}

/** Native tables avoid a scroll container that is not keyboard-focusable. */
function DocsTable(props: ComponentProps<"table">) {
  return <table {...props} />;
}

/** Authored links keep their target. External schema links stay in the same tab. */
function DocsLink({ children, ...props }: ComponentProps<"a">) {
  return <a {...props}>{children}</a>;
}

/**
 * MDX components for docs pages. Callout, Cards, and Accordions are the
 * scannable patterns for guardrails, guide maps, and long reference rows.
 * Term and GlossaryList share one glossary source.
 */
export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Accordion,
    Accordions,
    Callout,
    Card,
    Cards,
    GlossaryList,
    Mermaid,
    OpenAPIPage,
    Step,
    Steps,
    Tab,
    Tabs,
    Term,
    TypeTable,
    a: DocsLink,
    h1: plainHeading("h1"),
    h2: plainHeading("h2"),
    h3: plainHeading("h3"),
    h4: plainHeading("h4"),
    h5: plainHeading("h5"),
    h6: plainHeading("h6"),
    table: DocsTable,
    ...components,
  };
}
