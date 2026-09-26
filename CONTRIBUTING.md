# Contributing

Keep examples short, runnable, and consistent between Postman and Bruno. Use invented subjects and `sandbox@1`.

Before opening a pull request:

1. Check the [API reference](https://www.sanctionskit.com/docs/api-reference) for request and response fields.
2. Update both collections when changing a shared workflow.
3. Run `npm ci` and `npm test`.
4. Check documentation links and leave all shared credentials blank.

Describe the change and the checks you ran. If a request was not tested against the sandbox, say so. Do not upload private responses, API keys, local environments, or customer records.

Refresh OpenAPI with `npm run sync:openapi`; do not hand-edit its schemas. Report suspected API contract issues through [SanctionsKit support](https://www.sanctionskit.com/contact).
