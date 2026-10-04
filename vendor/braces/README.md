# Vendored `braces` 3.0.4 (GHSA-vfj7-8cjw-p6xm)

Upstream npm still ships `braces@3.0.3`, which remains in the advisory range for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

This directory is an **unmerged local fork**: the file contents match commit
`28d440b5dd449dbf1fe6f3506cf94ecca4d02660` from the open pull request
[micromatch/braces#72](https://github.com/micromatch/braces/pull/72) (depth-limit
fix for CVE-2026-93687). The version in `package.json` is bumped to **3.0.4**
only so `npm audit --audit-level=moderate` can treat the installed package as
outside the `<=3.0.3` advisory range while upstream has not published a release.

Atlas wires this tree through `devDependencies.braces` (`file:vendor/braces`) and
`overrides.braces: "$braces"` so every transitive `micromatch` consumer resolves
the same patched implementation.

Remove this vendor and the override when npm publishes an official `braces`
release above 3.0.3.
