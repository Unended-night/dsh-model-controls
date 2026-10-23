import assert from 'node:assert/strict'
import { importCurrent } from './current-runtime.mjs'
const pi = await importCurrent('@deepseek-ai/dsh-llm-pi-ai')
const { BlockAssembler, AssistantStreamAccumulator, expandAssistantStream } = await importCurrent('@deepseek-ai/dsh-llm')

// Only the service registration boundary is captured. Schema, SDK, adapter,
// serialization, assembly and durable-record validation are the shipped code.
export function nativeHarness(profile, apiKey = 'fixture-key-not-a-credential') {
  let adapter, discover
  const ctx = {
    fiber: { entry: { options: { id: 'llm-pi-ai' } } },
    get(name) { if (name === 'credentials') return { resolve: async () => ({ value: apiKey }) } },
    inject() {}, on() {}, logger: { warn() {}, error: console.error },
    llm: {
      registerAdapter(_routes, value) { adapter = value; return Object.assign(() => {}, { replace() {} }) },
      registerConfigurableProviders() { return Object.assign(() => {}, { replace() {} }) },
      registerModelDiscovery(_ns, handler) { discover = handler },
    },
  }
  const config = pi.Config({ providers: { primary: { apiKeyEnv: 'TEST_FIXTURE_KEY', ...profile } } })
  pi.apply(ctx, config)
  return { adapter, discover, config }
}

export async function collect(adapter, options) {
  const assembler = new BlockAssembler(), durable = new AssistantStreamAccumulator()
  const chunks = []
  for await (const chunk of adapter.stream(options)) {
    assembler.push(chunk)
    durable.push({ time: 1000 + chunks.length, chunk })
    chunks.push(chunk)
  }
  const restored = new BlockAssembler()
  const expanded = expandAssistantStream(JSON.parse(JSON.stringify(durable.snapshot())))
  for (const { chunk } of expanded) restored.push(chunk)
  assert.deepEqual(expanded.map(({ chunk }) => chunk), chunks, 'durable expansion must preserve the exact stream')
  assert.deepEqual(restored.blocks(), assembler.blocks(), 'reloaded content must match live content')
  assert.deepEqual(restored.finish, assembler.finish)
  assert.equal(chunks.at(-1)?.type, 'finish')
  return { assembler, chunks, durable: durable.snapshot(), restored }
}

export const fixtureTools = [
  { name: 'read_fixture', description: 'Read the requested test fixture.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
  { name: 'glob_fixture', description: 'List test fixture paths.', parameters: { type: 'object', properties: { pattern: { type: 'string' } }, required: ['pattern'] } },
]

export function fixtureResponse(text) {
  const bytes = new TextEncoder().encode(text)
  let offset = 0
  // Deliberately split UTF-8 characters, CRLF and every kind of JSON token.
  return new Response(new ReadableStream({
    pull(controller) {
      if (offset === bytes.length) { controller.close(); return }
      const next = Math.min(bytes.length, offset + 7)
      controller.enqueue(bytes.slice(offset, next))
      offset = next
    },
  }), { headers: { 'content-type': 'text/event-stream' } })
}

export function openAiFixture(final = false) {
  const frame = (delta, finish_reason = null) => ({ id: 'fixture-response', object: 'chat.completion.chunk', model: 'fixture-model', created: 1, choices: [{ index: 0, delta, finish_reason }] })
  const frames = final ? [frame({ role: 'assistant', content: 'Fixture round trip: 中文_ALPHA; BETA_OK' }), frame({}, 'stop')] : [
    frame({ role: 'assistant', reasoning_content: '检查两个文件。' }),
    frame({ tool_calls: [
      { index: 0, id: 'call_alpha', type: 'function', function: { name: 'read_fixture', arguments: '{"path":' } },
      { index: 1, id: 'call_beta', type: 'function', function: { name: 'glob_fixture', arguments: '{"pattern":' } },
    ] }),
    frame({ tool_calls: [{ index: 1, function: { arguments: '"**/*.md"}' } }, { index: 0, function: { arguments: '"中文.txt"}' } }] }),
    frame({}, 'tool_calls'),
  ]
  frames.push({ id: 'fixture-response', choices: [], usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 } })
  return 'data: null\r\n\r\n' + frames.map(frame => `data: ${JSON.stringify(frame)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n'
}

export function anthropicFixture(final = false) {
  const frames = [{ type: 'message_start', message: { id: 'msg_fixture', type: 'message', role: 'assistant', model: 'fixture-model', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 50, output_tokens: 0 } } }]
  if (final) frames.push(
    { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Fixture round trip: 中文_ALPHA; BETA_OK' } },
    { type: 'content_block_stop', index: 0 },
  )
  else frames.push(
    { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_alpha', name: 'read_fixture', input: {} } },
    { type: 'content_block_start', index: 1, content_block: { type: 'tool_use', id: 'toolu_beta', name: 'glob_fixture', input: {} } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"path":' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '{"pattern":' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'input_json_delta', partial_json: '"**/*.md"}' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '"中文.txt"}' } },
    { type: 'content_block_stop', index: 0 }, { type: 'content_block_stop', index: 1 },
  )
  frames.push({ type: 'message_delta', delta: { stop_reason: final ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 25 } }, { type: 'message_stop' })
  return 'data: null\n\n' + frames.map(frame => `event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`).join('')
}

export function responsesFixture(final = false) {
  const frames = [{ type: 'response.created', response: { id: 'resp_fixture' } }]
  const output = final ? [{ id: 'msg_fixture', type: 'message', role: 'assistant', status: 'completed', content: [{type:'output_text',text:'Fixture round trip: 中文_ALPHA; BETA_OK',annotations:[]}] }] : [
    {id:'fc_alpha',type:'function_call',call_id:'call_alpha',name:'read_fixture',arguments:'{"path":"中文.txt"}',status:'completed'},
    {id:'fc_beta',type:'function_call',call_id:'call_beta',name:'glob_fixture',arguments:'{"pattern":"**/*.md"}',status:'completed'},
  ]
  for(const [index,item] of output.entries()) frames.push({type:'response.output_item.added',output_index:index,item:{...item,...(final?{content:[]}:{arguments:''})}})
  if(final) frames.push({type:'response.output_text.delta',output_index:0,content_index:0,delta:output[0].content[0].text})
  else {
    frames.push({type:'response.function_call_arguments.delta',output_index:0,delta:'{"path":'})
    frames.push({type:'response.function_call_arguments.delta',output_index:1,delta:'{"pattern":'})
    frames.push({type:'response.function_call_arguments.delta',output_index:1,delta:'"**/*.md"}'})
    frames.push({type:'response.function_call_arguments.delta',output_index:0,delta:'"中文.txt"}'})
  }
  for(const [index,item] of output.entries()) frames.push({type:'response.output_item.done',output_index:index,item})
  frames.push({type:'response.completed',response:{id:'resp_fixture',status:'completed',model:'fixture-model',output,usage:{input_tokens:50,output_tokens:25,total_tokens:75}}})
  return 'data: null\r\n\r\n'+frames.map(frame=>`event: ${frame.type}\ndata: ${JSON.stringify(frame)}\n\n`).join('')
}
