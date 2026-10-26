import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  collectDocsLastModifiedSnapshot,
  DOCS_LAST_MODIFIED_SNAPSHOT_PATH,
  serializeDocsLastModifiedSnapshot,
} from "../src/lib/docs-last-modified";

const snapshot = await collectDocsLastModifiedSnapshot(process.cwd());
const destination = path.join(process.cwd(), DOCS_LAST_MODIFIED_SNAPSHOT_PATH);
writeFileSync(destination, serializeDocsLastModifiedSnapshot(snapshot));
console.log(
  `Wrote ${DOCS_LAST_MODIFIED_SNAPSHOT_PATH} for ${snapshot.contract.repository}@${snapshot.contract.sha} (${snapshot.contract.committedAt}).`
);
