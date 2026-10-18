"use client";

import { Step, Steps } from "fumadocs-ui/components/steps";
import { TypeTable } from "fumadocs-ui/components/type-table";

import { PublishedGetCurl } from "@/features/docs/observation-query-example";
import {
  observationNullSemantics,
  provenanceCitationPaths,
  provenanceNameTable,
} from "@/features/docs/provenance-evidence-model";
import { getDocsUrl } from "@/lib/public-origins";

const valueStateReference = `${getDocsUrl()}/api-reference/schemas#schema-valuestate`;

function valueStateDescription() {
  return (
    <>
      {observationNullSemantics.value_state.description}{" "}
      <a href={valueStateReference}>ValueState</a>
    </>
  );
}

export function ProvenanceCitationSteps() {
  return (
    <Steps>
      <Step>
        <h3>Discover</h3>
        <p>
          List current-release sources, then read the measure you will query.
          There is no methodologies collection. On the checked{" "}
          <code>case_count_floor_2023</code> measure,{" "}
          <code>methodology_id</code> and <code>source_ids</code> were null.
          Those nulls do not name the observation source.
        </p>
        <PublishedGetCurl path={provenanceCitationPaths.discoverSources} />
        <PublishedGetCurl path={provenanceCitationPaths.discoverMeasure} />
      </Step>
      <Step>
        <h3>Observe</h3>
        <p>
          Query one county in the lower 48 states or the District of Columbia.
          Read <code>value</code> with <code>value_state</code>,{" "}
          <code>limitations</code>, <code>source_id</code>, and{" "}
          <code>methodology_id</code> from that same row. Checked FIPS{" "}
          <code>08001</code> returned <code>value</code> null and{" "}
          <code>value_state</code> <code>MISSING</code>. Checked FIPS{" "}
          <code>36061</code> returned <code>value_state</code>{" "}
          <code>OBSERVED</code> and numeric <code>value</code> 1114.0. Save{" "}
          <code>meta.response_at</code> as the retrieval time.
        </p>
        <PublishedGetCurl path={provenanceCitationPaths.observeGap} />
      </Step>
      <Step>
        <h3>Resolve</h3>
        <p>
          Request the source and, when <code>methodology_id</code> is not null,
          the methodology. Keep each resource&apos;s own field names. On the
          checked <code>human</code> source, <code>published_at</code>,{" "}
          <code>atlas_acquired_at</code>, <code>upstream_updated_at</code>, and{" "}
          <code>source_retrieved_at</code> were null. The checked observation{" "}
          <code>atlas_acquired_at</code> was present. The checked methodology{" "}
          <code>version</code> matched the observation{" "}
          <code>release_methodology_version</code>. The observation{" "}
          <code>methodology_version</code> is the transformation version and
          differed. The observation <code>methodology</code> text matched the
          methodology <code>description</code>.
        </p>
        <PublishedGetCurl path={provenanceCitationPaths.resolveSource} />
        <PublishedGetCurl path={provenanceCitationPaths.resolveMethodology} />
      </Step>
    </Steps>
  );
}

export function ValueStateNullTable() {
  return (
    <TypeTable
      aria-label="Observation null semantics"
      id="value-state-null"
      type={{
        ...observationNullSemantics,
        value_state: {
          ...observationNullSemantics.value_state,
          description: valueStateDescription(),
        },
      }}
    />
  );
}

export function ProvenanceFieldNames() {
  return (
    <TypeTable
      aria-label="Source and observation field names"
      id="provenance-field-names"
      type={provenanceNameTable()}
    />
  );
}
