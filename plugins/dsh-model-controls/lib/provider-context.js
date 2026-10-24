import { AsyncLocalStorage } from 'node:async_hooks'

/** Carry the host's route ID through lazy SDK iteration, never infer it from URLs. */
export function installProviderContext(ctx) {
  const storage = new AsyncLocalStorage()
  const unlisten = ctx.on('llm/stream', (options, next) => (async function* () {
    const run = fn => storage.run(options.provider, fn)
    const iterator = run(() => next()[Symbol.asyncIterator]())
    let completed = false
    try {
      for (;;) {
        const item = await run(() => iterator.next())
        if (item.done) { completed = true; return }
        yield item.value
      }
    } finally {
      if (!completed && iterator.return) await run(() => iterator.return())
    }
  })(), { prepend: true })

  // Discovery has no stream middleware. Wrap the service method while preserving
  // Cordis's caller context; use its original target for exact cleanup comparison.
  const service = ctx.llm[Symbol.for('cordis.original')]
  const descriptor = Object.getOwnPropertyDescriptor(service, 'discoverModels')
  const previous = service.discoverModels
  const discover = function (namespace, request, signal) {
    return storage.run(request.provider, () => previous.call(this, namespace, request, signal))
  }
  service.discoverModels = discover
  return {
    current: () => storage.getStore(),
    dispose() {
      unlisten()
      if (service.discoverModels === discover) {
        if (descriptor) Object.defineProperty(service, 'discoverModels', descriptor)
        else delete service.discoverModels
      }
    },
  }
}
