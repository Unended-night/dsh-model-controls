/** Transport normalization for Harness model requests, independent of provider. */
import { normalizeToolSchemas } from './schema.js'
import { selectedUserAgent } from './user-agent.js'

const API_PATH = /\/(?:models|messages|chat\/completions|responses)\/?$/

function requestURL(input) {
  try { return new URL(input instanceof Request ? input.url : input) } catch { return undefined }
}

function nullEvent(event) {
  const data = event.split(/\r\n|\n|\r/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n')
  return data.trim() === 'null'
}

export function filterNullSse(response, onDrop = () => {}) {
  if (!response.body || !/\btext\/event-stream\b/i.test(response.headers.get('content-type') ?? '')) return response
  const decoder = new TextDecoder(), encoder = new TextEncoder()
  let pending = ''
  const emit = (event, separator, controller) => {
    if (event.length > 4 * 1024 * 1024) throw new Error('model-controls: oversized SSE event')
    if (nullEvent(event)) { onDrop(); controller.enqueue(encoder.encode(`: gateway heartbeat${separator || '\n\n'}`)) }
    else controller.enqueue(encoder.encode(event + separator))
  }
  const body = response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      pending += decoder.decode(chunk, { stream: true })
      for (;;) {
        const boundary = /\r\n\r\n|\n\n|\r\r/.exec(pending)
        if (!boundary) break
        emit(pending.slice(0, boundary.index), boundary[0], controller)
        pending = pending.slice(boundary.index + boundary[0].length)
      }
      if (pending.length > 4 * 1024 * 1024) throw new Error('model-controls: oversized SSE event')
    },
    flush(controller) {
      pending += decoder.decode()
      if (pending) emit(pending, '', controller)
    },
  }))
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.delete('content-encoding')
  return new Response(body, { status: response.status, statusText: response.statusText, headers })
}

/** Exactly one HTTP attempt; native agent recovery owns retries. */
export function createCompatibleFetch(original, options = {}) {
  const getConfig = options.config ?? (() => ({}))
  const lifetime = new AbortController()
  let active = true
  const stats = { requests: 0, adapted: 0, nullHeartbeats: 0, schemaObjectsNormalized: 0 }
  const call = (input, init) => Reflect.apply(original, globalThis, [input, init])

  const wrapped = async (input, init) => {
    const settings = getConfig()
    if (!active || settings.enabled === false) return call(input, init)
    const url = requestURL(input)
    if (!url || !API_PATH.test(url.pathname)) return call(input, init)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    // The process also hosts web tools. Only Harness-stamped model API calls qualify.
    if (!/deepseek-harness/i.test(headers.get('user-agent') ?? '')) return call(input, init)
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (method !== 'GET' && method !== 'POST') return call(input, init)
    const callerSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined)
    const signal = callerSignal ? AbortSignal.any([callerSignal, lifetime.signal]) : lifetime.signal
    signal.throwIfAborted()
    stats.requests++
    const userAgent = selectedUserAgent(settings)
    // Normalize serialized SDK tool schemas, without buffering opaque Request bodies.
    const normalized = normalizeToolSchemas(init?.body)
    stats.schemaObjectsNormalized += normalized.changed
    let request = { ...init, signal }
    if (userAgent !== undefined || normalized.changed) {
      if (userAgent !== undefined) { headers.set('user-agent', userAgent); stats.adapted++ }
      if (normalized.changed) headers.delete('content-length')
      request = { ...request, headers, ...(normalized.changed ? { body: normalized.body } : {}) }
    }
    const response = await call(input, request)
    // Return failures intact: never inspect their body or infer an identity from them.
    return response.ok ? filterNullSse(response, () => { stats.nullHeartbeats++ }) : response
  }
  return { fetch: wrapped, stats, deactivate() { active = false; lifetime.abort(new DOMException('Request controls disposed', 'AbortError')) } }
}

export function installCompatibleFetch(options) {
  const previous = globalThis.fetch
  const adapter = createCompatibleFetch(previous, options)
  globalThis.fetch = adapter.fetch
  return {
    ...adapter,
    dispose() {
      adapter.deactivate()
      if (globalThis.fetch === adapter.fetch) globalThis.fetch = previous
    },
  }
}
