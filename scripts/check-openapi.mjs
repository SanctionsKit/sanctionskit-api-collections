import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sourceUrl = 'https://www.sanctionskit.com/openapi.json';
export const serverUrl = 'https://www.sanctionskit.com/api/v1';
export const specPath = new URL('../openapi/sanctionskit.openapi.json', import.meta.url);
export const provenancePath = new URL('../openapi/source.json', import.meta.url);
const methods = new Set(['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']);

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function validateDocument(document) {
  assert.match(document.openapi ?? '', /^3\.1\.\d+$/, 'OpenAPI 3.1 is required');
  assert.equal(document.info?.title, 'SanctionsKit API');
  assert.ok(document.info?.version, 'API version is missing');
  assert.match(document['x-docs-revision'] ?? '', /^[a-f0-9]{64}$/, 'Docs revision is missing');
  assert.ok(Array.isArray(document.servers) && document.servers.length, 'Servers are missing');
  assert.ok(document.paths && Object.keys(document.paths).length, 'API paths are missing');
  assert.equal(document.components?.securitySchemes?.bearerAuth?.type, 'http');
  assert.equal(document.components?.securitySchemes?.bearerAuth?.scheme, 'bearer');

  let operationCount = 0;
  const operationIds = new Set();
  for (const [path, pathItem] of Object.entries(document.paths)) {
    assert.ok(path.startsWith('/'), `Invalid path: ${path}`);
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!methods.has(method)) continue;
      operationCount += 1;
      assert.ok(operation.operationId, `Missing operationId: ${method} ${path}`);
      assert.ok(!operationIds.has(operation.operationId), `Duplicate operationId: ${operation.operationId}`);
      operationIds.add(operation.operationId);
      const security = operation.security ?? document.security;
      assert.ok(
        Array.isArray(security) && security.length && security.every((entry) => Array.isArray(entry.bearerAuth)),
        `Bearer authentication is required: ${method} ${path}`,
      );
      assert.ok(Object.keys(operation.responses ?? {}).length, `Missing responses: ${method} ${path}`);
    }
  }
  assert.ok(operationCount, 'No API operations found');

  let referenceCount = 0;
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if ('$ref' in value) {
      const ref = value.$ref;
      assert.equal(typeof ref, 'string', 'A reference must be a string');
      assert.ok(ref.startsWith('#/'), `Expected a local JSON pointer: ${ref}`);
      const pointer = decodeURIComponent(ref.slice(2)).split('/').map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
      let target = document;
      for (const part of pointer) {
        assert.ok(target && typeof target === 'object' && Object.hasOwn(target, part), `Unresolved reference: ${ref}`);
        target = target[part];
      }
      referenceCount += 1;
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(document);
  return { operationCount, referenceCount };
}

export async function checkOpenApi() {
  const [specBytes, provenanceBytes] = await Promise.all([readFile(specPath), readFile(provenancePath)]);
  const document = JSON.parse(specBytes);
  const provenance = JSON.parse(provenanceBytes);
  const counts = validateDocument(document);
  assert.equal(provenance.sourceUrl, sourceUrl);
  assert.ok(Number.isFinite(Date.parse(provenance.retrievedAt)), 'Invalid retrieval timestamp');
  assert.match(provenance.sourceSha256 ?? '', /^[a-f0-9]{64}$/);
  assert.equal(provenance.docsRevision, document['x-docs-revision']);
  assert.equal(provenance.distributionSha256, sha256(specBytes), 'Distributed specification has changed');
  assert.ok(Array.isArray(provenance.originalServers) && provenance.originalServers.length);
  assert.deepEqual(document.servers, provenance.originalServers.map((server) => ({ ...server, url: serverUrl })));
  const restored = { ...document, servers: provenance.originalServers };
  assert.equal(provenance.sourceDocumentSha256, sha256(serialize(restored)), 'The API contract differs from its recorded source');
  return counts;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { operationCount, referenceCount } = await checkOpenApi();
    console.log(`OpenAPI verified: ${operationCount} operations, ${referenceCount} local references.`);
  } catch (error) {
    console.error(`OpenAPI check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
