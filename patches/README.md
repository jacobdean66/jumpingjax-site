# braces 3.0.3 depth mitigation

`braces@3.0.3.patch` mitigates
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
which had no upstream patched release when checked on October 5, 2026.

The parser and recursive AST consumers reject nesting deeper than 64 levels.
An iterative check also bounds AST node count and rejects child cycles before a
recursive walker runs. Ordinary brace alternatives and ranges retain their behavior.
Unusually deep glob patterns now raise SyntaxError intentionally.

`node scripts/test-braces-security.cjs` tests the actual installed transitive
dependency, including deeply nested text, direct AST input, cycles, and normal
patterns. This is a local mitigation, not an upstream fix; vulnerability audit
reports may continue to list 3.0.3. No advisory is ignored. Replace this patch
with a verified upstream fixed release when available.
