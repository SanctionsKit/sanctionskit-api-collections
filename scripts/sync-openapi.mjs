import { mkdir, writeFile } from 'node:fs/promises';
import {
  sourceUrl,
  serverUrl,
  specPath,
  provenancePath,
  sha256,
  serialize,
  validateDocument,
} from './check-openapi.mjs';

try {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  const document = JSON.parse(source);
  const { operationCount } = validateDocument(document);
  const originalServers = document.servers;
  const portable = { ...document, servers: originalServers.map((server) => ({ ...server, url: serverUrl })) };
  const output = serialize(portable);
  const provenance = {
    sourceUrl,
    retrievedAt: new Date().toISOString(),
    sourceSha256: sha256(source),
    sourceDocumentSha256: sha256(serialize(document)),
    distributionSha256: sha256(output),
    docsRevision: document['x-docs-revision'],
    originalServers,
    transformation: 'Replace root server URLs with the absolute production API URL.',
  };
  await mkdir(new URL('../openapi/', import.meta.url), { recursive: true });
  await writeFile(specPath, output);
  await writeFile(provenancePath, serialize(provenance));
  console.log(`Updated OpenAPI from ${sourceUrl}: ${operationCount} operations.`);
  console.log('Review the diff and update the collection examples before committing.');
} catch (error) {
  console.error(`OpenAPI sync failed: ${error.message}`);
  process.exitCode = 1;
}
