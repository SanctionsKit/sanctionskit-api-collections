# SanctionsKit OpenAPI specification

Import [`sanctionskit.openapi.json`](sanctionskit.openapi.json) into a client or documentation tool that supports OpenAPI 3.1.

The specification comes from the [production OpenAPI document](https://www.sanctionskit.com/openapi.json). This copy changes only the root server URLs to `https://www.sanctionskit.com/api/v1`, so requests work when the file is imported outside the website. Endpoint definitions, schemas, authentication requirements, and examples remain as published.

The [API reference](https://www.sanctionskit.com/docs/api-reference) explains the endpoints. The [documentation](https://www.sanctionskit.com/docs) covers integration and screening behavior. Examples labeled as synthetic or contract fixtures are illustrations, not live screening results.

## Update the specification

From the repository root, using Node.js 22 or later:

```sh
node scripts/sync-openapi.mjs
node scripts/check-openapi.mjs
```

Syncing fetches the current published document. Review its diff and any affected collection requests before committing. The command does not publish or commit changes.

[`source.json`](source.json) records the source URL, retrieval time, documentation revision, original server values, and SHA-256 hashes. `sourceSha256` fingerprints the downloaded bytes; `sourceDocumentSha256` fingerprints the source parsed and formatted with two-space indentation and a final newline. `distributionSha256` fingerprints this repository's portable copy.

The offline check validates operation metadata, bearer authentication, local references, and the file hashes. It restores the original server values before checking the source document hash, confirming that no other contract fields changed. It does not call the API or prove a live request succeeds.
