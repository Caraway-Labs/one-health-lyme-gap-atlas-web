import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  API_CHANGELOG_PAGE_RELATIVE_PATH,
  loadApiChangelog,
  renderApiChangelogPage,
} from "../src/lib/api-changelog.ts";

const page = renderApiChangelogPage(loadApiChangelog());
const destination = path.join(process.cwd(), API_CHANGELOG_PAGE_RELATIVE_PATH);
writeFileSync(destination, page);
console.log(`Wrote ${API_CHANGELOG_PAGE_RELATIVE_PATH}.`);
