# SanctionsKit Postman collection

Runnable sanctions screening API examples for people, organizations and vessels, plus retained evidence and batch screening. All subjects are invented and use the synthetic `sandbox@1` dataset.

## Get started

1. [Create a SanctionsKit workspace](https://www.sanctionskit.com/signup), then [create a sandbox API key](https://www.sanctionskit.com/dashboard/keys?environment=sandbox).
2. Give the key these scopes: `sources:read`, `screenings:write`, `results:read`, `batches:write`, `usage:read`.
3. Import `sanctionskit.postman_collection.json` and `sanctionskit.sandbox.postman_environment.json` into Postman.
4. Select **SanctionsKit — sandbox**. Set `apiKey` to your `sk_test_` key as a local environment value. Keep its shared value empty.
5. Run **02 Screen a person**, then **03 Retrieve a result** and **04 Download evidence**. The screening request saves `resultId` after a successful response.

The collection accepts sandbox keys and sends requests only to `https://www.sanctionskit.com/api/v1`. Redirects are disabled. Use the current Postman app with scripts enabled. If a request is skipped, check the Postman Console for setup instructions.

Read the [quickstart](https://www.sanctionskit.com/docs/quickstart) for account setup and the [API reference](https://www.sanctionskit.com/docs/api-reference) for the full contract.

## Requests and results

The person and vessel fixtures return `potential_match`; the organization fixture returns `no_match`. A potential match needs review. A no-match applies only to the selected coverage and matching rules. Errors are separate outcomes.

**01 Discover sources** reads production source metadata. These sandbox examples still use `sandbox@1`; they do not search those production sources. See [source selection](https://www.sanctionskit.com/docs/sources).

**04 Download evidence** returns a document with `format` and `result` at its root, without a `data` wrapper. Save sensitive responses only in authorized storage. See [retained evidence](https://www.sanctionskit.com/docs/evidence).

## Batch workflow

Run **07 Submit a batch**, then **08 Read batch progress**. The acceptance response saves `batchId`. Send the progress request again after about five seconds while status is `pending`, `importing` or `processing`; stop at `completed`, `failed` or `cancelled`.

Inspect each row: a completed batch can contain failed rows. The progress request saves the first completed row's `screening_id` as `batchResultId` for **09 Read a batch result**. Set that variable to another completed row's ID to inspect it.

For larger batches, wait until processing stops, then set `batchOffset` to each returned `nextOffset` until it is `null`. The three-row example fits on one page. There is no automatic polling loop, and a collection run does not wait for the batch to finish. See [batch screening](https://www.sanctionskit.com/docs/batches).

## Retries and new operations

Each POST creates an operation key only when its environment value is empty:

| Request | Variable |
| --- | --- |
| Screen a person | `screeningKey` |
| Screen an organization | `noMatchKey` |
| Screen a vessel | `vesselKey` |
| Submit a batch | `batchKey` |

Keep the key and request body unchanged after a timeout or when retrying. Clear the corresponding variable only when starting a new operation. Preserve keys before ending a session if an outcome is uncertain. Re-running with the same key retrieves the original operation; it does not create a fresh screening.

For `429` or temporary server failures, follow `Retry-After` and use bounded retries. Read [idempotency](https://www.sanctionskit.com/docs/idempotency) and [errors](https://www.sanctionskit.com/docs/errors). **10 Read usage** shows your current [sandbox allowance](https://www.sanctionskit.com/docs/usage).

Keep API keys local. Before exporting or sharing, clear credentials, saved IDs, operation keys and response history. Publish the blank environment template supplied here.
