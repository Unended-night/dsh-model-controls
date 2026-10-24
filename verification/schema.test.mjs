import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeToolSchemas } from '../plugins/dsh-model-controls/lib/schema.js'
import { createCompatibleFetch } from '../plugins/dsh-model-controls/lib/transport.js'

test('normalization retains optionality, nested constraints and values that resemble schemas', () => {
  const example = { type: 'object', properties: { label: { type: 'string' } } }
  const schema = {
    type: 'object', properties: {
      required: { type: 'string' },
      optional: { type: 'object', properties: { value: { type: 'string' } }, additionalProperties: false, default: example, examples: [example] },
      children: { type: 'array', items: { type: 'object', properties: {} } },
      choice: { anyOf: [{ type: 'object', properties: {} }, { type: 'null' }] },
    }, required: ['required'], additionalProperties: true,
  }
  const payload = { messages: [{ role: 'user', content: JSON.stringify(example) }], tools: [{ type: 'function', function: { name: 'fixture', strict: false, parameters: schema } }] }
  const result = normalizeToolSchemas(JSON.stringify(payload))
  const actual = JSON.parse(result.body)
  const parameters = actual.tools[0].function.parameters
  assert.equal(result.changed, 3)
  assert.deepEqual(parameters.required, ['required'])
  assert.deepEqual(parameters.properties.required, { type: 'string' })
  assert.deepEqual(parameters.properties.optional.required, [])
  assert.equal(parameters.properties.optional.additionalProperties, false)
  assert.deepEqual(parameters.properties.optional.default, example)
  assert.deepEqual(parameters.properties.optional.examples, [example])
  assert.deepEqual(parameters.properties.children.items.required, [])
  assert.deepEqual(parameters.properties.choice.anyOf[0].required, [])
  assert.deepEqual(parameters.properties.choice.anyOf[1], { type: 'null' })
  assert.equal(parameters.additionalProperties, true)
  assert.equal(actual.tools[0].function.strict, false)
  assert.deepEqual(actual.messages, payload.messages)
  assert.equal(schema.properties.optional.required, undefined)
})

test('chat completions, Responses and Messages retain explicit empty arrays', () => {
  const tools = [
    { type: 'function', function: { name: 'chat', parameters: { type: 'object', properties: {} } } },
    { type: 'function', name: 'responses', parameters: { type: 'object', properties: {} } },
    { name: 'messages', input_schema: { type: 'object', properties: {} } },
    { type: 'web_search' },
  ]
  const result = normalizeToolSchemas(JSON.stringify({ tools }))
  const actual = JSON.parse(result.body).tools
  assert.equal(result.changed, 3)
  assert.deepEqual(actual[0].function.parameters.required, [])
  assert.deepEqual(actual[1].parameters.required, [])
  assert.deepEqual(actual[2].input_schema.required, [])
  assert.deepEqual(actual[3], tools[3])
  assert.deepEqual(normalizeToolSchemas(result.body), { body: result.body, changed: 0 })
})

test('non-tool requests, malformed JSON and stream bodies remain byte-for-byte untouched', () => {
  for (const body of ['not-json', 'null', '[1,2]', '{ "messages": [] }', JSON.stringify({ tools: [{ type: 'function', function: { parameters: { type: 'object', required: ['x'], properties: { x: { type: 'number' } } } } }] }), new ReadableStream()]) {
    assert.deepEqual(normalizeToolSchemas(body), { body, changed: 0 })
  }
})

test('schema normalization applies to every Harness model provider and drops stale content length', async () => {
  const body = JSON.stringify({ tools: [{ type: 'function', function: { name: 'get_goal', parameters: { type: 'object', properties: {} } } }] })
  const headers = { 'user-agent': 'deepseek-harness/0.2.0', 'content-type': 'application/json', 'content-length': String(Buffer.byteLength(body)), authorization: 'Bearer fixture-auth' }
  const requests = []
  const compat = createCompatibleFetch(async (_input, init) => { requests.push(init); return new Response('{}') })
  const abort = new AbortController()
  await compat.fetch('https://models.example.invalid/v1/chat/completions', { method: 'POST', body, headers, signal: abort.signal })
  await compat.fetch('https://other.example/v1/chat/completions', { method: 'POST', body, headers, signal: abort.signal })
  assert.ok(requests.every(row => JSON.parse(row.body).tools[0].function.parameters.required.length === 0))
  const changed = requests.at(-1)
  assert.deepEqual(JSON.parse(changed.body).tools[0].function.parameters.required, [])
  assert.equal(changed.headers.has('content-length'), false)
  assert.equal(changed.headers.get('authorization'), headers.authorization)
  abort.abort()
  assert.equal(changed.signal.aborted, true)
  assert.equal(compat.stats.schemaObjectsNormalized, 2)
  for (const [url, agent] of [['https://models.example.invalid/v1/chat/completions', 'web-tool'], ['https://models.example.invalid/article', headers['user-agent']]]) {
    await compat.fetch(url, { method: 'POST', body, headers: { ...headers, 'user-agent': agent } })
    assert.equal(requests.at(-1).body, body)
  }
})
