// Isolated Chromium layout check; never connects to the running Harness/profile.
// Set NODE_PATH to a node_modules directory containing Playwright.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const { chromium } = createRequire(import.meta.url)('playwright')
const output = new URL('./results/settings-ui/', import.meta.url)
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 960, height: 1000 } })
const errors = []
page.on('pageerror', error => errors.push(error.message))
const control = label => page.getByLabel(label, { exact: true })
try {
  await page.setContent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>
    body { margin: 0; background: #141820; color: #edf0f6; font: 14px/1.5 "Segoe UI", "Microsoft YaHei", sans-serif; }
    main { width: 680px; margin: 32px auto; }
    :root { --dsw-alias-label-primary: #edf0f6; --dsw-alias-label-secondary: #a8afbd; --dsw-alias-border-l2: #414754; --dsw-alias-bg-layer-1: #20252e; --dsw-alias-bg-layer-2: #272b33; --dsw-alias-settings-card-fill: #1a1f28; --dsw-alias-interactive-bg-hover: #343b48; --dsw-alias-brand-primary-new-colorprimary-new-color: #6e91ff; }
    /* Exact colliding rules observed in installed dsh-context/lib/client.js. */
    .lc-grid{border-top:1px dashed var(--dsw-alias-border-l2);pointer-events:none;position:absolute;left:0;right:0}
    .lc-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:10px;margin-bottom:14px;padding:14px 16px}
  </style><main id="root"></main></html>`)
  for (const name of ['react', 'react-dom']) {
    const root = dirname(createRequire(import.meta.url).resolve(name + '/package.json'))
    await page.addScriptTag({ path: join(root, 'umd', name + '.development.js') })
  }
  await page.evaluate(() => {
    let row = { ns: 'llm-compat', revision: 7, value: { enabled: true, headerMode: 'native', customUserAgent: 'ExampleClient/1.0', recoveryMode: 'retry', maxRetries: 60, retryDelaySeconds: 1, retryForever: false, maxAutoContinues: 3, continueDelaySeconds: 2, continueMessage: '请继续完成。', providerHeaders: {} } }
    let nativeRow = { ns: 'llm-pi-ai', revision: 11, value: { providers: { primary: { displayName: '主渠道', streamIdleTimeoutMs: 300000 }, backup: { displayName: '备用渠道', streamIdleTimeoutMs: 120000 } } } }
    window.writes = []
    window.__ModuleLoader__ = { load({ factory }) {
      const plugin = factory(name => name === 'react' ? React : { jsx: (type, props, key) => React.createElement(type, { ...props, key }) })
      plugin.apply({
        effect(fn) { window.disposeNavigationIcon = fn() },
        slots: { inject(_slot, fn) { fn() }, register(_entry, render) { ReactDOM.createRoot(document.getElementById('root')).render(render()) } },
        remote: { settings: {
          async describe() { return { ok: true, value: { writable: true, namespaces: [row, nativeRow] } } },
          async update(ns, patch, revision) {
            window.writes.push({ ns, patch, revision })
            if (ns === 'llm-pi-ai') {
              const providers = { ...nativeRow.value.providers }
              for (const [id, value] of Object.entries(patch.providers)) providers[id] = { ...providers[id], ...value }
              nativeRow = { ...nativeRow, revision: revision + 1, value: { providers } }
              return { ok: true, value: nativeRow }
            }
            const value = { ...row.value, ...patch }; if (patch.providerHeaders) value.providerHeaders = { ...row.value.providerHeaders, ...patch.providerHeaders }; row = { ...row, revision: revision + 1, value }; return { ok: true, value: row }
          },
        } },
      })
    } }
  })
  await page.addScriptTag({ content: readFileSync(new URL('../plugins/dsh-llm-compat/lib/client.js', import.meta.url), 'utf8') })
  await control('额外重试次数').waitFor()
  const layout = () => page.evaluate(() => {
    const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width } }
    const grid = document.querySelector('[aria-label="额外重试次数"]').closest('.dsh-llm-compat-grid')
    const card = grid.parentElement
    const input = document.querySelector('[aria-label="额外重试次数"]')
    const timeout = document.querySelector('.dsh-llm-compat-provider')
    return { grid: box(grid), card: box(card), input: box(input), footer: box(document.querySelector('[aria-label="全局重试设置"] .dsh-llm-compat-footer')), timeout: { card: box(timeout), controls: [...timeout.querySelectorAll('input, select, button')].map(box) }, position: getComputedStyle(grid).position, pointerEvents: getComputedStyle(grid).pointerEvents, padding: getComputedStyle(card).paddingLeft, overflow: document.documentElement.scrollWidth > innerWidth }
  })
  // Prove the fixture reproduces the reported collision when the old name returns.
  await control('额外重试次数').evaluate(input => input.closest('.dsh-llm-compat-grid').classList.add('lc-grid'))
  assert.equal((await layout()).position, 'absolute')
  assert.equal((await layout()).pointerEvents, 'none')
  await control('额外重试次数').evaluate(input => input.closest('.dsh-llm-compat-grid').classList.remove('lc-grid'))
  const measurements = []
  for (const width of [680, 480, 320]) {
    await page.setViewportSize({ width: width + 48, height: 1050 })
    await page.locator('main').evaluate((node, width) => { node.style.width = `${width}px` }, width)
    const m = await layout()
    assert.equal(m.position, 'static')
    assert.equal(m.pointerEvents, 'auto')
    assert.equal(m.overflow, false)
    assert.ok(m.timeout.card.bottom < m.card.y, 'channel card is above global recovery')
    assert.ok(m.input.x - m.card.x >= 18)
    assert.ok(m.grid.bottom < m.card.bottom)
    assert.ok(m.footer.y >= m.card.bottom)
    assert.ok(m.input.right < m.card.right)
    for (const control of m.timeout.controls) {
      assert.ok(control.x - m.timeout.card.x >= 18)
      assert.ok(m.timeout.card.right - control.right >= 18)
      assert.ok(control.bottom < m.timeout.card.bottom)
    }
    measurements.push({ width, ...m })
  }
  await page.setViewportSize({ width: 760, height: 1000 })
  await page.locator('main').evaluate(node => { node.style.width = '680px' })
  const descriptions = new Set()
  for (const mode of ['native', 'claude-code', 'codex', 'pi', 'custom']) {
    await control('User-Agent 模式').selectOption(mode)
    descriptions.add(await page.locator('#llm-compat-headerMode-help').textContent())
    assert.equal(await control('自定义 User-Agent').count(), mode === 'custom' ? 1 : 0)
  }
  assert.equal(descriptions.size, 5)
  await control('User-Agent 模式').selectOption('claude-code')
  assert.match(await page.locator('#llm-compat-headerMode-help').textContent(), /不附加 Claude 专属字段/)
  await control('User-Agent 模式').evaluate(node => node.closest('.dsh-llm-compat-card').scrollIntoView())
  await page.locator('.dsh-llm-compat-card').filter({ has: control('User-Agent 模式') }).screenshot({ path: fileURLToPath(new URL('claude-user-agent.png', output)) })
  await control('User-Agent 模式').selectOption('native')
  await page.screenshot({ path: fileURLToPath(new URL('dark-default.png', output)), fullPage: true })
  await control('不限重试次数').check()
  assert.equal(await control('额外重试次数').isDisabled(), true)
  assert.equal(await control('每次重试等待（秒）').isEnabled(), true)
  await page.screenshot({ path: fileURLToPath(new URL('dark-unlimited.png', output)), fullPage: true })
  await control('启用模型请求控制与统一重试').uncheck()
  for (const label of ['User-Agent 模式', '恢复模式', '不限重试次数', '额外重试次数', '每次重试等待（秒）']) assert.equal(await control(label).isDisabled(), true)
  await control('启用模型请求控制与统一重试').check()
  await control('不限重试次数').uncheck()
  await control('额外重试次数').fill('0')
  assert.equal(await control('每次重试等待（秒）').isDisabled(), true)
  await control('额外重试次数').fill('60')
  await control('User-Agent 模式').click()
  assert.equal(await control('User-Agent 模式').evaluate(node => node.matches(':open')), true)
  const picker = await control('User-Agent 模式').evaluate(node => {
    const css = getComputedStyle(node, '::picker(select)')
    const option = node.options[0].getBoundingClientRect()
    return { appearance: css.appearance, padding: css.padding, radius: css.borderRadius, background: css.backgroundColor, optionWidth: option.width, optionHeight: option.height }
  })
  assert.equal(picker.appearance, 'base-select')
  assert.equal(picker.padding, '6px')
  assert.equal(picker.radius, '10px')
  assert.ok(picker.optionWidth > 100 && picker.optionHeight >= 38)
  await page.screenshot({ path: fileURLToPath(new URL('dark-picker.png', output)), fullPage: true })
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  assert.equal(await control('User-Agent 模式').inputValue(), 'claude-code')
  assert.equal(await control('User-Agent 模式').evaluate(node => node.matches(':open')), false)
  await control('恢复模式').click()
  await page.getByRole('option', { name: '重试耗尽后发送继续消息', exact: true }).click()
  assert.match(await page.locator('#llm-compat-recoveryMode-help').textContent(), /发送可见的继续消息/)
  await control('继续消息内容').waitFor()
  await control('最多自动继续次数').fill('0')
  assert.equal(await control('发送继续消息前等待（秒）').isDisabled(), true)
  assert.equal(await control('继续消息内容').isDisabled(), true)
  await page.getByRole('button', { name: '保存全局配置' }).click()
  await page.getByRole('status').filter({ hasText: '已保存；' }).waitFor()
  assert.deepEqual(await page.evaluate(() => window.writes[0].patch), { recoveryMode: 'continue', maxAutoContinues: 0 })
  await page.getByRole('button', { name: '保存渠道配置', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '渠道配置已保存；' }).waitFor()
  assert.deepEqual(await page.evaluate(() => window.writes[1]), { ns: 'llm-compat', patch: { providerHeaders: { primary: { headerMode: 'claude-code', customUserAgent: 'ExampleClient/1.0' } } }, revision: 8 })
  assert.equal(await control('流空闲超时（秒）').inputValue(), '300')
  await control('模型渠道').selectOption('backup')
  assert.equal(await control('流空闲超时（秒）').inputValue(), '120')
  await control('流空闲超时（秒）').fill('600')
  await page.getByRole('button', { name: '保存渠道配置', exact: true }).click()
  await page.getByRole('status').filter({ hasText: '渠道配置已保存；' }).waitFor()
  assert.deepEqual(await page.evaluate(() => window.writes[2]), { ns: 'llm-pi-ai', patch: { providers: { backup: { streamIdleTimeoutMs: 600000 } } }, revision: 11 })
  await control('模型渠道').selectOption('primary')
  assert.equal(await control('User-Agent 模式').inputValue(), 'claude-code')
  assert.equal(await control('流空闲超时（秒）').inputValue(), '300')
  await page.getByRole('form', { name: '渠道请求设置' }).screenshot({ path: fileURLToPath(new URL('timeout-settings.png', output)) })
  await page.screenshot({ path: fileURLToPath(new URL('dark-continue.png', output)), fullPage: true })
  await page.addStyleTag({ content: `body { background:#f5f6f8; color:#202530; } :root { --dsw-alias-label-primary:#202530; --dsw-alias-label-secondary:#626b7a; --dsw-alias-border-l2:#ccd1db; --dsw-alias-bg-layer-1:#fff; --dsw-alias-bg-layer-2:#f5f6f8; --dsw-alias-settings-card-fill:#fff; --dsw-alias-interactive-bg-hover:#e9edf4; --dsw-alias-brand-primary-new-colorprimary-new-color:#416bdb; }` })
  await control('User-Agent 模式').click()
  await page.screenshot({ path: fileURLToPath(new URL('light-picker.png', output)), fullPage: true })
  await page.keyboard.press('Escape')
  assert.equal(await control('User-Agent 模式').inputValue(), 'claude-code')
  // Reproduce the current host's navigation markup: icon followed by label,
  // with no custom-icon registration API. Check late mount and plugin cleanup.
  await page.evaluate(() => {
    const dialog = document.createElement('div')
    dialog.dataset.shortcutModal = 'settings'
    dialog.style.cssText = 'position:fixed;left:0;top:0;width:230px;padding:8px;background:#fff;z-index:100'
    dialog.innerHTML = '<nav>' + ['通用设置', '模型请求控制'].map(label => `<button type="button" style="display:flex;align-items:center;gap:8px;padding:9px 12px;width:100%;border:0;border-radius:8px;background:#fff;color:#26324a;font:14px/22px sans-serif"><svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor"/></svg><span>${label}</span></button>`).join('') + '</nav>'
    document.body.appendChild(dialog)
  })
  const nav = page.locator('[data-dsh-llm-compat-nav]')
  await nav.waitFor()
  const navStyle = await nav.evaluate(node => ({ original: getComputedStyle(node.firstElementChild).display, mask: getComputedStyle(node, '::before').maskImage, color: getComputedStyle(node, '::before').backgroundColor }))
  assert.equal(navStyle.original, 'none')
  assert.match(navStyle.mask, /data:image\/svg\+xml/)
  assert.equal(navStyle.color, 'rgb(38, 50, 74)')
  assert.equal(await page.getByRole('button', { name: '通用设置', exact: true }).evaluate(node => getComputedStyle(node.firstElementChild).display === 'none'), false)
  await nav.evaluate(node => { node.style.color = '#416bdb'; node.style.background = '#e9edf4' })
  assert.equal(await nav.evaluate(node => getComputedStyle(node, '::before').backgroundColor), 'rgb(65, 107, 219)')
  await page.locator('[data-shortcut-modal="settings"] nav').screenshot({ path: fileURLToPath(new URL('navigation-icon.png', output)) })
  await page.evaluate(() => window.disposeNavigationIcon())
  assert.equal(await page.locator('[data-dsh-llm-compat-nav]').count(), 0)
  assert.equal(await page.getByRole('button', { name: '模型请求控制', exact: true }).evaluate(node => getComputedStyle(node.firstElementChild).display === 'none'), false)
  assert.deepEqual(errors, [])
  const report = { browser: browser.version(), measurements, picker, navStyle, errors, checks: ['collision reproduced with old class', 'isolated layout at 680/480/320px including timeout card padding', 'master/unlimited/zero disabled states', 'native picker styles and keyboard selection/Escape', 'mouse option selection', 'User-Agent and recovery descriptions follow selection', 'React save patch', 'channel identity and timeout save independently from global recovery; selection preserves values', 'navigation icon on late mount, inherited color and cleanup'], limitation: 'Isolated React page with reproduced conflicting CSS and theme tokens; not a screenshot of the live Harness settings dialog.' }
  writeFileSync(new URL('report.json', output), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally {
  await browser.close()
}
