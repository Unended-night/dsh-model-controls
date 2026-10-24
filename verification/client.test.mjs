import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { importCurrent } from './current-runtime.mjs'
import ReactDOM from 'react-dom/server'
import NativeReact from 'react'

const { Context } = await importCurrent('@deepseek-ai/cordis')

// Cordis enforces service declarations and React DOM validates the full element tree.
// Hook state and RPC responses are simulated so save/error paths remain deterministic.
function harness({ reject = false, writable = true, providers = { primary: {}, backup: {} }, legacy = {} } = {}) {
  const values = [], effects = [], writes = []
  let cursor = 0, component, module, mounted = false, tree
  const initial = { enabled: true, headerMode: 'native', customUserAgent: 'custom-client/1.0', recoveryMode: 'retry', maxRetries: 5, retryDelaySeconds: 2, retryForever: false, maxAutoContinues: 3, continueDelaySeconds: 2, continueMessage: '请继续完成。', providerHeaders: {}, ...legacy }
  let row = { ns: 'llm-compat', value: initial, revision: 7 }
  let nativeRow = providers && { ns: 'llm-pi-ai', value: { providers }, revision: 11 }
  const React = {
    createElement(type, props, ...children) { return typeof type === 'function' ? type(props) : { type, props: props ?? {}, children: children.flat(Infinity).filter(x => x != null && x !== false) } },
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value }] },
    useEffect(fn) { if (!mounted) effects.push(fn) },
  }
  const services = {
    slots: { inject(_name, fn) { fn() }, register(_entry, render) { component = render } },
    remote: { settings: {
      async describe() { return { ok: true, value: { writable, namespaces: [row, ...(nativeRow ? [nativeRow] : [])] } } },
      async update(ns, patch, revision) {
        writes.push({ ns, patch, revision })
        if (typeof reject === 'function' ? reject(ns, writes.length) : reject) return { ok: false, error: { message: 'settings/conflict' } }
        if (ns === 'llm-pi-ai') {
          const next = { ...nativeRow.value.providers }
          for (const [id, fields] of Object.entries(patch.providers)) next[id] = { ...next[id], ...fields }
          nativeRow = { ...nativeRow, revision: nativeRow.revision + 1, value: { providers: next } }
          return { ok: true, value: nativeRow }
        }
        const value = { ...row.value, ...patch }
        if (patch.providerHeaders) value.providerHeaders = { ...row.value.providerHeaders, ...patch.providerHeaders }
        row = { ...row, value, revision: row.revision + 1 }
        return { ok: true, value: row }
      },
    } },
  }
  const ctx = new Context()
  const provider = ctx.plugin({
    name: 'settings-fixture',
    apply(scope) {
      for (const [name, value] of Object.entries(services)) scope.reflect.provide(name, value)
      scope.reflect.provide('remote.settings', services.remote.settings)
    },
  })
  vm.runInNewContext(readFileSync(new URL('../plugins/dsh-llm-compat/lib/client.js', import.meta.url), 'utf8'), {
    // Browser layout/navigation is exercised separately in settings-layout.mjs.
    document: { createElement: () => ({ remove() {} }), head: { appendChild() {} }, body: {}, querySelectorAll: () => [] },
    MutationObserver: class { observe() {} disconnect() {} },
    window: { __ModuleLoader__: { load({ factory }) { module = factory(name => name === 'react' ? React : { jsx: (type, props) => React.createElement(type, props, props.children) }) } } },
  })
  const plugin = ctx.plugin(module)
  const nativeElement = node => node == null || typeof node !== 'object' ? node
    : NativeReact.createElement(node.type, node.props, ...node.children.map(nativeElement))
  const render = () => {
    cursor = 0; tree = component(); mounted = true
    ReactDOM.renderToStaticMarkup(nativeElement(tree))
    return tree
  }
  const nodes = () => { const all = []; const walk = n => { if (!n || typeof n !== 'object') return; all.push(n); n.children.forEach(walk) }; walk(tree); return all }
  const control = label => nodes().find(n => n.props['aria-label'] === label)
  return { writes, render, nodes, control, dispose() { plugin.dispose(); provider.dispose() }, async load() { await provider; await plugin; render(); for (const fn of effects) fn(); await new Promise(resolve => setImmediate(resolve)); render() },
    change(label, value) { assert.equal(control(label).props.disabled, false); control(label).props.onChange({ target: { value } }); render() },
    toggle(label, checked) { assert.equal(control(label).props.disabled, false); control(label).props.onChange({ target: { checked } }); render() },
    async save() { await control('全局重试设置').props.onSubmit({ preventDefault() {} }); render() },
    async saveChannel() { await control('渠道请求设置').props.onSubmit({ preventDefault() {} }); render() },
  }
}

test('settings page saves only edited fields with the loaded revision; custom UA and continue controls appear', async t => {
  const f = harness(); t.after(() => f.dispose()); await f.load()
  assert.equal(f.nodes().some(n => n.props['aria-label'] === '自定义 User-Agent'), false)
  f.change('User-Agent 模式', 'custom'); f.change('自定义 User-Agent', 'ExampleClient/1.0')
  f.change('恢复模式', 'continue'); f.change('继续消息内容', '继续测试')
  f.change('额外重试次数', '60'); await f.saveChannel(); await f.save()
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes)), [{ ns: 'llm-compat', patch: { providerHeaders: { primary: { headerMode: 'custom', customUserAgent: 'ExampleClient/1.0' } } }, revision: 7 }, { ns: 'llm-compat', patch: { recoveryMode: 'continue', maxRetries: 60, continueMessage: '继续测试' }, revision: 8 }])
  assert.ok(f.nodes().some(n => n.props.role === 'status' && n.children.join('').startsWith('已保存')))
  assert.equal(f.nodes().find(n => n.type === 'button').props.disabled, true)
})

test('settings conflict retains unsaved changes and reports failure', async t => {
  const f = harness({ reject: true }); t.after(() => f.dispose()); await f.load(); f.change('额外重试次数', '60'); await f.save()
  assert.ok(f.nodes().some(n => n.props.role === 'status' && /保存失败.*conflict/.test(n.children.join(''))))
  assert.equal(f.nodes().find(n => n.props['aria-label'] === '额外重试次数').props.value, 60)
  assert.equal(f.nodes().find(n => n.type === 'button' && n.children.includes('保存全局配置')).props.disabled, false)
})

test('mode descriptions follow the selected User-Agent and recovery modes before saving', async t => {
  const f = harness(); t.after(() => f.dispose()); await f.load()
  const help = key => f.nodes().find(n => n.props.id === `llm-compat-${key}-help`).children.join('')
  const descriptions = new Set()
  for (const [mode, expected] of [['native', /保留 Harness \/ SDK/], ['claude-code', /Claude Code.*不附加 Claude 专属字段/], ['codex', /Codex CLI/], ['pi', /pi.*操作系统和架构/], ['custom', /下方填写/]]) {
    f.change('User-Agent 模式', mode)
    assert.match(help('headerMode'), expected)
    descriptions.add(help('headerMode'))
    assert.equal(Boolean(f.control('自定义 User-Agent')), mode === 'custom')
    assert.equal(f.control('User-Agent 模式').props['aria-describedby'], 'llm-compat-headerMode-help')
  }
  assert.equal(descriptions.size, 5)
  assert.match(help('recoveryMode'), /次数耗尽后结束/)
  f.change('恢复模式', 'continue')
  assert.match(help('recoveryMode'), /发送可见的继续消息/)
  f.change('恢复模式', 'retry')
  assert.match(help('recoveryMode'), /次数耗尽后结束/)
  assert.equal(f.writes.length, 0, 'previewing a mode does not silently save it')
})

test('read-only settings disable editing and saving', async t => {
  const f = harness({ writable: false }); t.after(() => f.dispose()); await f.load()
  assert.equal(f.nodes().find(n => n.type === 'fieldset').props.disabled, true)
  assert.equal(f.nodes().find(n => n.type === 'button').props.disabled, true)
  assert.equal(f.control('启用模型请求控制与统一重试').props.disabled, true)
})

test('master switch disables subordinate fields, remains saveable, and preserves settings when re-enabled', async t => {
  const f = harness(); t.after(() => f.dispose()); await f.load()
  f.change('User-Agent 模式', 'custom'); f.change('自定义 User-Agent', 'ExampleClient/1.0')
  f.change('恢复模式', 'continue'); f.change('额外重试次数', '60')
  f.change('继续消息内容', '保留已完成的工作，继续。'); await f.saveChannel(); await f.save()
  f.toggle('启用模型请求控制与统一重试', false)
  for (const node of f.nodes().filter(n => ['input', 'select', 'textarea'].includes(n.type))) {
    assert.equal(node.props.disabled, !['启用模型请求控制与统一重试', '模型渠道', '流空闲超时（秒）'].includes(node.props['aria-label']))
  }
  assert.equal(f.nodes().find(n => n.type === 'button' && n.children.includes('保存全局配置')).props.disabled, false)
  await f.save()
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes.at(-1).patch)), { enabled: false })
  f.toggle('启用模型请求控制与统一重试', true)
  assert.equal(f.control('额外重试次数').props.disabled, false)
  assert.equal(f.control('额外重试次数').props.value, 60)
  assert.equal(f.control('自定义 User-Agent').props.value, 'ExampleClient/1.0')
  assert.equal(f.control('继续消息内容').props.value, '保留已完成的工作，继续。')
  await f.save()
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes.at(-1).patch)), { enabled: true })
})

test('unlimited and zero retries disable only irrelevant fields across recovery-mode changes', async t => {
  const f = harness(); t.after(() => f.dispose()); await f.load()
  f.change('额外重试次数', '60')
  f.toggle('不限重试次数', true)
  assert.equal(f.control('额外重试次数').props.disabled, true)
  assert.equal(f.control('每次重试等待（秒）').props.disabled, false)
  f.change('恢复模式', 'continue')
  assert.equal(f.control('额外重试次数').props.disabled, false)
  assert.equal(f.control('额外重试次数').props.value, 60)
  f.change('额外重试次数', '0')
  assert.equal(f.control('每次重试等待（秒）').props.disabled, true)
  assert.equal(f.control('发送继续消息前等待（秒）').props.disabled, false)
  f.change('恢复模式', 'retry')
  assert.equal(f.control('不限重试次数').props.checked, true)
  assert.equal(f.control('每次重试等待（秒）').props.disabled, false)
  f.toggle('不限重试次数', false)
  assert.equal(f.control('额外重试次数').props.disabled, false)
  assert.equal(f.control('额外重试次数').props.value, 0)
  assert.equal(f.control('每次重试等待（秒）').props.disabled, true)
  f.change('额外重试次数', '60')
  assert.equal(f.control('每次重试等待（秒）').props.disabled, false)
  assert.equal(f.control('每次重试等待（秒）').props.value, 2)
})

test('zero automatic continuations disables timing and message without clearing either value', async t => {
  const f = harness(); t.after(() => f.dispose()); await f.load()
  f.change('恢复模式', 'continue')
  f.change('继续消息内容', '继续检查结果。')
  f.change('发送继续消息前等待（秒）', '4')
  f.change('最多自动继续次数', '0')
  assert.equal(f.control('最多自动继续次数').props.disabled, false)
  assert.equal(f.control('发送继续消息前等待（秒）').props.disabled, true)
  assert.equal(f.control('继续消息内容').props.disabled, true)
  await f.save()
  f.change('最多自动继续次数', '3')
  assert.equal(f.control('发送继续消息前等待（秒）').props.disabled, false)
  assert.equal(f.control('发送继续消息前等待（秒）').props.value, 4)
  assert.equal(f.control('继续消息内容').props.disabled, false)
  assert.equal(f.control('继续消息内容').props.value, '继续检查结果。')
})

test('timeout saves one native provider field in milliseconds and keeps plugin draft separate', async t => {
  const f = harness({ providers: { primary: { displayName: '主渠道' }, backup: { streamIdleTimeoutMs: 120000 } } }); t.after(() => f.dispose()); await f.load()
  assert.equal(f.control('流空闲超时（秒）').props.value, 300)
  f.change('额外重试次数', '60')
  f.change('流空闲超时（秒）', '600')
  f.change('模型渠道', 'backup')
  assert.equal(f.control('流空闲超时（秒）').props.value, 120)
  f.change('流空闲超时（秒）', '900'); await f.saveChannel()
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes)), [{ ns: 'llm-pi-ai', patch: { providers: { backup: { streamIdleTimeoutMs: 900000 } } }, revision: 11 }])
  assert.equal(f.control('额外重试次数').props.value, 60)
  f.change('模型渠道', 'primary')
  assert.equal(f.control('流空闲超时（秒）').props.value, '600')
  assert.ok(f.nodes().some(n => n.props.role === 'status' && n.children.join('') === '当前渠道有未保存的修改'))
  f.toggle('启用模型请求控制与统一重试', false)
  assert.equal(f.control('流空闲超时（秒）').props.disabled, false)
  await f.saveChannel()
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes.at(-1))), { ns: 'llm-pi-ai', patch: { providers: { primary: { streamIdleTimeoutMs: 600000 } } }, revision: 12 })
})

test('timeout rejects invalid intervals and retains draft on revision conflict', async t => {
  const f = harness({ reject: true, providers: { primary: {} } }); t.after(() => f.dispose()); await f.load()
  for (const value of ['', '0', '-1', '2147483.648']) { f.change('流空闲超时（秒）', value); await f.saveChannel() }
  assert.equal(f.writes.length, 0)
  f.change('流空闲超时（秒）', '600'); await f.saveChannel()
  assert.equal(f.control('流空闲超时（秒）').props.value, '600')
  assert.ok(f.nodes().some(n => n.props.role === 'status' && /渠道配置保存失败.*conflict/.test(n.children.join(''))))
})

test('native timeout fields remain read-only when the profile cannot be edited', async t => {
  const f = harness({ writable: false, providers: { primary: {} } }); t.after(() => f.dispose()); await f.load()
  assert.equal(f.control('流空闲超时（秒）').props.disabled, true)
  assert.equal(f.control('模型渠道').props.disabled, true)
  await f.saveChannel()
  assert.equal(f.writes.length, 0)
})

test('channel drafts and saved identities remain isolated, including legacy defaults', async t => {
  const f = harness({ legacy: { headerMode: 'codex' } }); t.after(() => f.dispose()); await f.load()
  assert.equal(f.control('User-Agent 模式').props.value, 'codex')
  f.change('User-Agent 模式', 'custom'); f.change('自定义 User-Agent', 'Primary/1.0')
  f.change('流空闲超时（秒）', '600')
  f.change('模型渠道', 'backup')
  assert.equal(f.control('User-Agent 模式').props.value, 'codex')
  assert.equal(f.control('流空闲超时（秒）').props.value, 300)
  f.change('User-Agent 模式', 'native'); await f.saveChannel()
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes[0].patch)), { providerHeaders: { backup: { headerMode: 'native', customUserAgent: 'custom-client/1.0' } } })
  f.change('模型渠道', 'primary')
  assert.equal(f.control('自定义 User-Agent').props.value, 'Primary/1.0')
  assert.equal(f.control('流空闲超时（秒）').props.value, '600')
  await f.saveChannel()
  assert.deepEqual(f.writes.map(w => [w.ns, w.revision]), [['llm-compat', 7], ['llm-compat', 8], ['llm-pi-ai', 11]])
  f.change('模型渠道', 'backup')
  assert.equal(f.control('User-Agent 模式').props.value, 'native')
  assert.equal(f.control('流空闲超时（秒）').props.value, 300)
  f.change('模型渠道', 'primary')
  assert.equal(f.control('User-Agent 模式').props.value, 'custom')
  assert.equal(f.control('流空闲超时（秒）').props.value, 600)
})

test('partial channel save reports the saved identity and retries only the failed timeout', async t => {
  const f = harness({ reject: (ns, count) => ns === 'llm-pi-ai' && count === 2 }); t.after(() => f.dispose()); await f.load()
  f.change('User-Agent 模式', 'claude-code'); f.change('流空闲超时（秒）', '600')
  await f.saveChannel()
  assert.ok(f.nodes().some(n => n.props.role === 'status' && /User-Agent 已保存，流空闲超时保存失败/.test(n.children.join(''))))
  assert.equal(f.control('流空闲超时（秒）').props.value, '600')
  await f.saveChannel()
  assert.deepEqual(f.writes.map(w => w.ns), ['llm-compat', 'llm-pi-ai', 'llm-pi-ai'])
  assert.equal(f.control('User-Agent 模式').props.value, 'claude-code')
  assert.equal(f.control('流空闲超时（秒）').props.value, 600)
})

test('invalid custom identities never partially save a channel timeout', async t => {
  const f = harness(); t.after(() => f.dispose()); await f.load()
  f.change('User-Agent 模式', 'custom'); f.change('流空闲超时（秒）', '600')
  for (const value of ['', ' ', '中文', 'x\r\nInjected: y']) {
    f.change('自定义 User-Agent', value); await f.saveChannel()
  }
  assert.equal(f.writes.length, 0)
})

test('without channels the page explains how to add one and global recovery stays editable', async t => {
  const f = harness({ providers: {} }); t.after(() => f.dispose()); await f.load()
  assert.equal(f.control('User-Agent 模式'), undefined)
  assert.ok(f.nodes().some(n => /尚未配置模型渠道/.test(n.children.join(''))))
  f.change('额外重试次数', '20'); await f.save()
  assert.deepEqual(JSON.parse(JSON.stringify(f.writes[0].patch)), { maxRetries: 20 })
})
