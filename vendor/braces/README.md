# Vendored `braces` 3.0.4 (GHSA-vfj7-8cjw-p6xm)

Upstream npm still ships `braces@3.0.3`, which remains in the advisory range for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). This
tree is the depth-limit fix from
[micromatch/braces#72](https://github.com/FSDevelop/braces/pull/72) (commit
`28d440b5dd449dbf1fe6f3506cf94ecca4d02660`), republished locally as **3.0.4**
so `npm audit --audit-level=moderate` can resolve the advisory without replacing
`fast-glob` with an incompatible alias.

Remove this vendor and the root `overrides.braces` / `devDependencies.braces`
entries when npm publishes an official release above 3.0.3.
