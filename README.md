# SanctionsKit API collections

Postman and Bruno collections for the [SanctionsKit sanctions screening API](https://www.sanctionskit.com/product/api), plus the complete OpenAPI 3.1 specification. Try name screening, inspect match evidence, and submit a batch using a free synthetic sandbox.

[Create a workspace](https://www.sanctionskit.com/signup) · [Get a sandbox API key](https://www.sanctionskit.com/dashboard/keys?environment=sandbox) · [Developer docs](https://www.sanctionskit.com/docs) · [API reference](https://www.sanctionskit.com/docs/api-reference)

## Choose your client

| Resource | Start here |
| --- | --- |
| Postman | [Import the collection and environment](postman/README.md) |
| Bruno | [Open the collection folder](bruno/README.md) |
| OpenAPI | [Download the specification](openapi/sanctionskit.openapi.json) · [Import and update notes](openapi/README.md) |

The collections cover the same ten requests: source discovery, a person screening, result retrieval, a JSON evidence download, an organization screening, a vessel screening, batch submission, batch progress, a batch row's result, and usage. The OpenAPI file describes the wider API, including monitoring, review cases, webhooks, and reports.

## Make your first request

1. [Sign up](https://www.sanctionskit.com/signup) and create a workspace.
2. Open [API keys](https://www.sanctionskit.com/dashboard/keys?environment=sandbox), select **Sandbox**, and create a key with `sources:read`, `screenings:write`, `results:read`, `batches:write`, and `usage:read`.
3. Follow the setup in the [Postman](postman/README.md) or [Bruno](bruno/README.md) folder. Set `apiKey` locally; the checked-in templates are blank.
4. Send **Screen a person**, then retrieve its saved result and evidence.

The base URL is `https://www.sanctionskit.com/api/v1`. Send the key as a Bearer token. The key selects the environment, so no environment header is needed.

```json
{
  "subject": {
    "name": "Alex Morgan",
    "entityType": "person",
    "birthDate": "1984"
  },
  "package": "sandbox@1",
  "retention": "standard"
}
```

Alex Morgan is an invented sandbox subject. The examples also include a fictional organization with a no-match result and a vessel with an identifier match. Sandbox data does not represent real sanctions records and does not consume paid production allowance.

Requests that create screenings or batches use separate idempotency keys. Keep the key and body unchanged when retrying. Clear that request's key variable before starting a new operation; each client guide names the variables.

See the [quickstart](https://www.sanctionskit.com/docs/quickstart), [authentication guide](https://www.sanctionskit.com/docs/authentication), and [idempotency guide](https://www.sanctionskit.com/docs/idempotency) for the details.

## Work through a batch

Send the inline batch, then poll its progress about every five seconds. A `202` response means the batch was accepted. It does not mean every subject has been screened.

When processing ends, inspect every row. A completed batch can contain failed rows. Follow `nextOffset` until it is `null`, and use a completed row's `screening_id` to retrieve its result. A failed or cancelled row is not a no-match result. The included batch fits on one page.

Read the [batch screening guide](https://www.sanctionskit.com/docs/batches) for file uploads, row outcomes, and pagination.

## Use results in your application

SanctionsKit supports sanctions screening and watchlist screening in AML and KYC workflows, customer onboarding, and vendor checks. A `potential_match` needs review. A `no_match` applies only to the selected coverage and screening policy; it is not legal clearance.

These collections are configured for synthetic sandbox use. For production integration, review [source availability](https://www.sanctionskit.com/docs/sources), choose eligible source IDs or a versioned package, and use a production key in your own integration. Source discovery describes the production catalog; listing a source does not make it available to every workspace or to the sandbox package.

| Learn more | Documentation |
| --- | --- |
| Request fields and matching | [Screening requests](https://www.sanctionskit.com/docs/screenings) · [Matching methodology](https://www.sanctionskit.com/methodology) |
| Retained results and exports | [Results and evidence](https://www.sanctionskit.com/docs/evidence) · [Retention](https://www.sanctionskit.com/docs/retention) |
| Retries and rate limits | [Errors](https://www.sanctionskit.com/docs/errors) · [Usage and limits](https://www.sanctionskit.com/docs/usage) |
| Production coverage | [Source directory](https://www.sanctionskit.com/datasets) · [Coverage](https://www.sanctionskit.com/coverage) |
| Plans and data safeguards | [Pricing](https://www.sanctionskit.com/pricing) · [Security](https://www.sanctionskit.com/security) |

## Maintain the examples

Node.js 22 or newer is needed only for repository checks and OpenAPI updates. You do not need Node.js to open either collection.

```sh
npm ci
npm test
```

To refresh the specification from the production site:

```sh
npm run sync:openapi
npm test
```

Review contract changes before updating the collections. Checks validate the files and request contracts locally; authenticated sandbox requests require your own key.

For application code, see [SanctionsKit API examples](https://github.com/SanctionsKit/sanctions-kit-examples).

## Contributing

Small fixes and clearer examples are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Keep credentials and real customer data out of issues, screenshots, and pull requests. Report sensitive issues through the [security contact](SECURITY.md).

## License

[MIT](LICENSE). The license covers these repository files. Use of the hosted service and third-party source data remains subject to their applicable terms.
