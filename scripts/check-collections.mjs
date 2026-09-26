import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import Ajv2020 from 'ajv/dist/2020.js';
import AjvDraft04 from 'ajv-draft-04';
import addFormats from 'ajv-formats';
import bruno from '@usebruno/lang';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const json = async (path) => JSON.parse(await read(path));
const [spec, postman, environment, schema, collectionText, environmentText, config] = await Promise.all([
  json('openapi/sanctionskit.openapi.json'),
  json('postman/sanctionskit.postman_collection.json'),
  json('postman/sanctionskit.sandbox.postman_environment.json'),
  json('scripts/schemas/postman-collection-v2.1.0.json'),
  read('bruno/collection.bru'),
  read('bruno/environments/Sandbox.bru'),
  json('bruno/bruno.json'),
]);
const ajv = addFormats(new Ajv2020({ strict: false, allErrors: true }));
const postmanAjv = addFormats(new AjvDraft04({ strict: false, allErrors: true }));
const validCollection = postmanAjv.compile(schema);
assert.ok(validCollection(postman), `Postman schema: ${postmanAjv.errorsText(validCollection.errors)}`);
assert.match(postman.info.schema, /v2\.1\.0/);

const collection = bruno.collectionBruToJson(collectionText);
const brunoEnvironment = bruno.bruToEnvJsonV2(environmentText);
const filenames = (await readdir(new URL('../bruno/', import.meta.url))).filter((name) => /^\d.*\.bru$/.test(name)).sort();
const requests = await Promise.all(filenames.map(async (name) => bruno.bruToJsonV2(await read(`bruno/${name}`))));
const flatten = (items) => items.flatMap((item) => item.item ? flatten(item.item) : [item]);
const items = flatten(postman.item);
assert.equal(items.length, 10, 'Expected ten quickstart requests');
assert.equal(requests.length, items.length, 'Postman and Bruno request counts differ');
assert.equal(config.version, '1');
assert.equal(collection.auth.mode, 'bearer');
assert.equal(collection.auth.bearer.token, '{{apiKey}}');
assert.equal(postman.auth.type, 'bearer');
assert.equal(postman.auth.bearer.find((entry) => entry.key === 'token')?.value, '{{apiKey}}');

const defaults = Object.fromEntries(environment.values.map(({ key, value }) => [key, value]));
const brunoDefaults = Object.fromEntries(brunoEnvironment.variables.map(({ name, value }) => [name, value]));
assert.deepEqual(brunoDefaults, defaults, 'Environment templates differ');
assert.equal(defaults.baseUrl, 'https://www.sanctionskit.com/api/v1');
assert.equal(defaults.apiKey, '', 'Never commit an API key');
assert.equal(environment.values.find(({ key }) => key === 'apiKey')?.type, 'secret');
assert.equal(brunoEnvironment.variables.find(({ name }) => name === 'apiKey')?.secret, true);
for (const key of ['resultId', 'batchId', 'batchResultId', 'screeningKey', 'noMatchKey', 'vesselKey', 'batchKey']) {
  assert.equal(defaults[key], '', `Environment ${key} must start empty`);
}

const placeholderId = '00000000-0000-4000-8000-000000000001';
const examples = {
  ...defaults,
  resultId: placeholderId,
  batchId: placeholderId,
  batchResultId: placeholderId,
  screeningKey: 'example-screening-key',
  noMatchKey: 'example-no-match-key',
  vesselKey: 'example-vessel-key',
  batchKey: 'example-batch-key',
};
const interpolate = (value, variables = examples) => value.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
  assert.ok(Object.hasOwn(variables, key), `Unknown variable: ${key}`);
  return variables[key];
});
const headers = (entries, keyName) => Object.fromEntries((entries ?? [])
  .filter((entry) => entry.disabled !== true && entry.enabled !== false)
  .map((entry) => [entry[keyName].toLowerCase(), entry.value]));
const rawUrl = (request) => typeof request.url === 'string' ? request.url : request.url.raw;
function operationFor(method, path) {
  for (const [template, definition] of Object.entries(spec.paths)) {
    const templateParts = template.split('/');
    const parts = path.split('/');
    if (parts.length !== templateParts.length) continue;
    if (!templateParts.every((part, index) => /^\{[^}]+\}$/.test(part) || part === parts[index])) continue;
    const operation = definition[method.toLowerCase()];
    if (operation) return { operation, template, parts, templateParts };
  }
  assert.fail(`Undocumented operation: ${method} ${path}`);
}
function validate(value, schema, label) {
  const check = ajv.compile({ ...schema, components: spec.components });
  assert.ok(check(value), `${label}: ${ajv.errorsText(check.errors)}`);
}
for (const [index, item] of items.entries()) {
  const request = requests[index];
  assert.equal(request.meta.seq, String(index + 1));
  assert.equal(request.meta.name, item.name);
  assert.equal(request.http.method.toUpperCase(), item.request.method);
  assert.equal(request.http.auth, 'inherit');
  assert.ok(!item.request.auth || item.request.auth.type === 'inherit');
  const url = rawUrl(item.request);
  assert.equal(request.http.url, url, `${item.name}: URL differs`);
  assert.ok(url.startsWith('{{baseUrl}}/'));
  const expectedQuery = [...new URL(url.replace('{{baseUrl}}', 'https://example.invalid')).searchParams];
  const postmanQuery = (item.request.url.query ?? []).filter((entry) => !entry.disabled).map(({ key, value }) => [key, value]);
  const brunoQuery = (request.params ?? []).filter((entry) => entry.type === 'query' && entry.enabled).map(({ name, value }) => [name, value]);
  assert.deepEqual(postmanQuery, expectedQuery, `${item.name}: Postman query differs from URL`);
  assert.deepEqual(brunoQuery, expectedQuery, `${item.name}: Bruno query differs from URL`);
  const postmanHeaders = headers(item.request.header, 'key');
  assert.deepEqual(headers(request.headers, 'name'), postmanHeaders, `${item.name}: headers differ`);
  assert.equal(postmanHeaders.accept, 'application/json');
  const parsedUrl = new URL(interpolate(url));
  const { operation, template, parts, templateParts } = operationFor(item.request.method, parsedUrl.pathname.replace('/api/v1', ''));
  const body = item.request.body ? JSON.parse(item.request.body.raw) : undefined;
  assert.deepEqual(request.body?.json ? JSON.parse(request.body.json) : undefined, body, `${item.name}: body differs`);
  if (body) {
    assert.equal(postmanHeaders['content-type'], 'application/json');
    for (const screening of body.subjects ?? [body]) assert.equal(screening.package, 'sandbox@1');
    validate(body, operation.requestBody.content['application/json'].schema, item.name);
  } else {
    assert.ok(!operation.requestBody?.required, `${item.name}: required request body missing`);
  }
  for (const parameter of operation.parameters ?? []) {
    let value;
    if (parameter.in === 'query') value = parsedUrl.searchParams.get(parameter.name) ?? undefined;
    if (parameter.in === 'header') value = postmanHeaders[parameter.name.toLowerCase()];
    if (parameter.in === 'path') value = parts[templateParts.indexOf(`{${parameter.name}}`)];
    if (value === undefined) {
      assert.ok(!parameter.required, `${item.name}: ${parameter.name} missing`);
      continue;
    }
    value = interpolate(value);
    if (parameter.schema.type === 'integer' || parameter.schema.type === 'number') value = Number(value);
    validate(value, parameter.schema, `${template} ${parameter.name}`);
  }
  for (const key of parsedUrl.searchParams.keys()) {
    assert.ok(operation.parameters?.some((parameter) => parameter.in === 'query' && parameter.name === key), `Undocumented query parameter: ${key}`);
  }
}

console.log(`Collections verified: ${items.length} matching Postman and Bruno requests, sandbox templates, request schemas.`);

const eventScript = (target, phase) => (target.event ?? [])
  .filter((event) => event.listen === phase).map((event) => event.script.exec.join('\n')).join('\n');
for (const item of [postman, ...items]) {
  for (const phase of ['prerequest', 'test']) new vm.Script(eventScript(item, phase));
}
for (const request of [collection, ...requests]) {
  new vm.Script(request.script?.req ?? '');
  new vm.Script(request.tests ?? '');
}
// Exercise guard and variable logic without sending requests.
function run(tool, index, phase, options = {}) {
  const env = { ...defaults, apiKey: `sk_test_${'a'.repeat(43)}`, ...options.env };
  const variables = { ...env, ...options.effective };
  const url = options.url ?? rawUrl(items[index].request);
  const sentHeaders = {};
  const body = options.body ?? {};
  let blocked = false;
  let maxRedirects;
  const stop = new Error('request skipped');
  const replace = (value) => value.replace(/\{\{([^}]+)\}\}/g, (_, key) =>
    key === '$guid' || key === '$randomUUID' ? placeholderId : variables[key] ?? `{{${key}}}`);
  const set = (key, value) => { env[key] = value; variables[key] = value; };
  const context = {
    console: { error() {}, log() {} },
    pm: {
      variables: { get: (key) => variables[key], replaceIn: replace },
      environment: { get: (key) => options.selected === false ? undefined : env[key], set },
      execution: { skipRequest: () => { blocked = true; throw stop; } },
      request: { url: { toString: () => url }, headers: { upsert: ({ key, value }) => { sentHeaders[key] = value; } } },
      response: { code: options.status ?? 200, json: () => body },
      test() {},
    },
    bru: {
      getEnvName: () => options.selected === false ? undefined : 'Sandbox',
      getEnvVar: (key) => env[key], setEnvVar: set, interpolate: replace,
    },
    req: {
      getUrl: () => url,
      setHeader: (key, value) => { sentHeaders[key] = value; },
      setMaxRedirects: (value) => { maxRedirects = value; },
      setTimeout() {},
    },
    res: { getStatus: () => options.status ?? 200, getBody: () => body },
    test() {},
  };
  const scripts = tool === 'postman'
    ? (phase === 'pre' ? [eventScript(postman, 'prerequest'), eventScript(items[index], 'prerequest')] : [eventScript(items[index], 'test')])
    : (phase === 'pre' ? [collection.script?.req, requests[index].script?.req] : [requests[index].tests]);
  for (const script of scripts.filter(Boolean)) {
    try { vm.runInNewContext(script, context, { timeout: 1000 }); }
    catch (error) {
      if (phase !== 'pre') throw error;
      blocked = true;
      break;
    }
  }
  return { env, blocked, sentHeaders, maxRedirects };
}
for (const tool of ['postman', 'bruno']) {
  assert.equal(run(tool, 0, 'pre').blocked, false, `${tool}: valid sandbox request blocked`);
  for (const options of [
    { selected: false },
    { env: { apiKey: '' } },
    { env: { apiKey: `sk_live_${'a'.repeat(43)}` } },
    { effective: { apiKey: `sk_live_${'a'.repeat(43)}` } },
    { env: { apiKey: 'sk_test_short' } },
    { env: { baseUrl: 'http://www.sanctionskit.com/api/v1' } },
    { effective: { baseUrl: 'https://example.com/api/v1' } },
    { url: 'https://www.sanctionskit.com.evil.example/api/v1/sources' },
  ]) {
    assert.equal(run(tool, 0, 'pre', options).blocked, true, `${tool}: unsafe request allowed`);
  }
  if (tool === 'bruno') assert.equal(run(tool, 0, 'pre').maxRedirects, 0);
  else for (const item of items) assert.equal(item.protocolProfileBehavior?.followRedirects, false);

  for (const [index, key] of [[1, 'screeningKey'], [4, 'noMatchKey'], [5, 'vesselKey'], [6, 'batchKey']]) {
    const first = run(tool, index, 'pre');
    assert.equal(first.blocked, false);
    assert.match(first.env[key], /^[\w:.-]{8,128}$/);
    assert.equal(first.sentHeaders['Idempotency-Key'], first.env[key]);
    const retry = run(tool, index, 'pre', { env: first.env });
    assert.equal(retry.env[key], first.env[key], `${tool}: retries must retain their key`);
    assert.equal(run(tool, index, 'pre', { env: { [key]: 'short' } }).blocked, true);
  }
  for (const [index, key] of [[2, 'resultId'], [3, 'resultId'], [7, 'batchId'], [8, 'batchResultId']]) {
    assert.equal(run(tool, index, 'pre').blocked, true, `${tool}: missing ${key} allowed`);
    assert.equal(run(tool, index, 'pre', { env: { [key]: placeholderId } }).blocked, false);
  }
  for (const batchOffset of ['-1', '1.5', '10001', 'abc']) {
    assert.equal(run(tool, 7, 'pre', { env: { batchId: placeholderId, batchOffset } }).blocked, true);
  }

  const saved = { resultId: placeholderId, batchId: placeholderId, batchResultId: placeholderId };
  for (const index of items.keys()) {
    const result = run(tool, index, 'test', { status: 401, body: { error: { code: 'invalid_api_key' } }, env: saved });
    for (const key of Object.keys(saved)) assert.equal(result.env[key], saved[key], `${tool}: error changed ${key}`);
  }
  const person = { id: placeholderId, environment: 'sandbox', status: 'potential_match', matches: [{}] };
  assert.equal(run(tool, 1, 'test', { status: 201, body: { data: person } }).env.resultId, placeholderId);
  for (const change of [{ id: 'bad-id' }, { environment: 'production' }, { status: 'no_match' }, { matches: [] }]) {
    assert.equal(run(tool, 1, 'test', { status: 201, body: { data: { ...person, ...change } } }).env.resultId, '');
  }
  const batch = { id: placeholderId, status: 'pending', total: 3 };
  const progress = { id: placeholderId, environment: 'sandbox', rows: [{ status: 'completed', screening_id: placeholderId }] };
  assert.equal(run(tool, 7, 'test', { body: { data: progress }, env: { batchId: placeholderId } }).env.batchResultId, placeholderId);
  for (const change of [{ id: 'different' }, { environment: 'production' }, { rows: [{ status: 'failed', screening_id: placeholderId }] }, { rows: [{ status: 'completed', screening_id: 'bad-id' }] }]) {
    assert.equal(run(tool, 7, 'test', { body: { data: { ...progress, ...change } }, env: { batchId: placeholderId } }).env.batchResultId, '');
  }
  assert.equal(run(tool, 6, 'test', { status: 202, body: { data: batch } }).env.batchId, placeholderId);
  for (const change of [{ id: 'bad-id' }, { status: 'failed' }, { total: 0 }]) {
    assert.equal(run(tool, 6, 'test', { status: 202, body: { data: { ...batch, ...change } } }).env.batchId, '');
  }
}
console.log('Scripts verified: sandbox guards, redirects, stable retry keys, required IDs, and error-safe ID capture.');
