# SanctionsKit Bruno collection

Plain-text `.bru` examples for the SanctionsKit sanctions screening API. Try synthetic person, organization and vessel screening, inspect retained evidence, and submit a small batch.

## Get started

1. [Create a SanctionsKit workspace](https://www.sanctionskit.com/signup), then [create a sandbox API key](https://www.sanctionskit.com/dashboard/keys?environment=sandbox).
2. Give the key these scopes: `sources:read`, `screenings:write`, `results:read`, `batches:write`, `usage:read`.
3. In Bruno, choose **Open Collection** and select this `bruno` directory, which contains `bruno.json`.
4. Select **Sandbox**. Open its environment settings and set the secret variable `apiKey` to your `sk_test_` key. Keep it marked as a secret.
5. Run **02 Screen a person**, then **03 Retrieve a result** and **04 Download evidence**.

Use a current Bruno release with scripts enabled. The collection accepts sandbox keys, restricts requests to `https://www.sanctionskit.com/api/v1`, and disables redirects. Bruno stores the secret value locally; the environment file contains only its name. See [Bruno secret variables](https://docs.usebruno.com/secrets-management/secret-variables).

The [SanctionsKit quickstart](https://www.sanctionskit.com/docs/quickstart) covers setup, and the [API reference](https://www.sanctionskit.com/docs/api-reference) describes every endpoint.

## Read the results

Alex Morgan, Juniper Example Cooperative and Example Horizon are invented fixtures. The person and vessel examples return `potential_match`; the organization returns `no_match`. Potential matches need review. No-match applies only to the selected coverage and matching rules; it is not legal clearance.

**01 Discover sources** shows production source metadata. The screening requests use the separate `sandbox@1` dataset, not production source records. Read [source selection](https://www.sanctionskit.com/docs/sources) before adapting an integration for production.

The person request saves `resultId` for retrieval and evidence. The other individual examples leave that value unchanged. Evidence has `format` and `result` at its root, without a `data` wrapper. See [screening results](https://www.sanctionskit.com/docs/screenings) and [retained evidence](https://www.sanctionskit.com/docs/evidence).

## Run a batch

Run **07 Submit a batch** to save `batchId`, then **08 Read batch progress**. Repeat the progress request about every five seconds while the batch is `pending`, `importing` or `processing`. Stop at `completed`, `failed` or `cancelled`, and inspect each row. A completed batch can include failed rows.

The progress request saves the first completed row's `screening_id` as `batchResultId`. Run **09 Read a batch result** to inspect it, or set `batchResultId` to another completed row's ID. The request cannot run until a completed row exists.

For more than one page, wait until processing stops and set `batchOffset` to each returned `nextOffset` until `null`. This three-row batch fits on one page. Collection runs do not poll automatically or wait for batch completion. Read the [batch guide](https://www.sanctionskit.com/docs/batches).

## Retry the same operation

Each POST sets an environment key only when it is empty:

| Request | Variable |
| --- | --- |
| Screen a person | `screeningKey` |
| Screen an organization | `noMatchKey` |
| Screen a vessel | `vesselKey` |
| Submit a batch | `batchKey` |

Keep the same key and body when retrying. Clear the corresponding key in the active environment only to begin a new operation. Changing a body without changing its key produces an idempotency conflict.

Scripts keep operation keys and returned IDs in memory. Before closing Bruno after an uncertain request, preserve its key so you can retry the same operation. Do not commit saved IDs, operation keys or response exports. See [idempotency](https://www.sanctionskit.com/docs/idempotency).

**10 Read usage** shows current [sandbox allowance](https://www.sanctionskit.com/docs/usage). For rate limits and temporary failures, honor `Retry-After`, keep retries bounded, and follow the [error guide](https://www.sanctionskit.com/docs/errors).
