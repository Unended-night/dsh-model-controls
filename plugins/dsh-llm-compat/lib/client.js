// Native desktop/web client module. No extra server endpoint or config file.
window.__ModuleLoader__.load({ id: 'dsh-llm-compat', factory: require => {
  const React = require('react')
  const { jsx } = require('react/jsx-runtime')
  const h = (type, props, ...children) => {
    const { key, ...rest } = props ?? {}
    return jsx(type, children.length ? { ...rest, children: children.length === 1 ? children[0] : children } : rest, key)
  }
  const { useEffect, useState } = React
  const styles = `
    .dsh-llm-compat-settings { --dsh-llm-compat-text: var(--dsw-alias-label-primary, #edf0f6); --dsh-llm-compat-muted: var(--dsw-alias-label-secondary, #9ba3b2); --dsh-llm-compat-border: var(--dsw-alias-border-l2, #414754); --dsh-llm-compat-fill: var(--dsw-alias-bg-layer-2, #272b33); --dsh-llm-compat-accent: var(--dsw-alias-brand-primary-new-colorprimary-new-color, #6e91ff); width: 100%; max-width: 680px; padding: 0 4px 24px; color: var(--dsh-llm-compat-text); font: inherit; line-height: 1.5; }
    .dsh-llm-compat-settings, .dsh-llm-compat-settings * { box-sizing: border-box; }
    .dsh-llm-compat-settings h2 { margin: 0 0 6px; font-size: 20px; font-weight: 600; }
    .dsh-llm-compat-settings .dsh-llm-compat-intro { margin: 0 0 20px; color: var(--dsh-llm-compat-muted); font-size: 13px; }
    .dsh-llm-compat-settings fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
    .dsh-llm-compat-settings .dsh-llm-compat-master, .dsh-llm-compat-settings .dsh-llm-compat-card { padding: 18px; margin: 0 0 16px; border: 1px solid var(--dsh-llm-compat-border); border-radius: 10px; background: var(--dsw-alias-settings-card-fill, transparent); }
    .dsh-llm-compat-settings h3 { margin: 0 0 16px; font-size: 14px; font-weight: 600; }
    .dsh-llm-compat-settings .dsh-llm-compat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 16px; align-items: start; }
    .dsh-llm-compat-settings .dsh-llm-compat-field { display: block; min-width: 0; margin: 0 0 16px; }
    .dsh-llm-compat-settings .dsh-llm-compat-field:last-child, .dsh-llm-compat-settings .dsh-llm-compat-grid > .dsh-llm-compat-field { margin-bottom: 0; }
    .dsh-llm-compat-settings .dsh-llm-compat-grid + .dsh-llm-compat-field { margin-top: 16px; }
    .dsh-llm-compat-settings .dsh-llm-compat-label { display: block; margin-bottom: 7px; font-size: 13px; font-weight: 500; }
    .dsh-llm-compat-settings .dsh-llm-compat-help { display: block; margin-top: 6px; color: var(--dsh-llm-compat-muted); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
    .dsh-llm-compat-settings .dsh-llm-compat-control { display: block; width: 100%; min-width: 0; min-height: 40px; border: 1px solid var(--dsh-llm-compat-border); border-radius: 8px; padding: 9px 12px; background: var(--dsh-llm-compat-fill); color: var(--dsh-llm-compat-text); font: inherit; font-size: 13px; line-height: 1.5; }
    .dsh-llm-compat-settings .dsh-llm-compat-control:enabled:hover { border-color: var(--dsw-alias-border-l4, #697386); }
    .dsh-llm-compat-settings .dsh-llm-compat-control:focus-visible, .dsh-llm-compat-settings .dsh-llm-compat-switch:focus-visible, .dsh-llm-compat-settings button:focus-visible { outline: 2px solid var(--dsh-llm-compat-accent); outline-offset: 3px; }
    .dsh-llm-compat-settings .dsh-llm-compat-control:disabled { opacity: .45; cursor: not-allowed; }
    .dsh-llm-compat-settings .dsh-llm-compat-field[data-disabled="true"] .dsh-llm-compat-label { color: var(--dsh-llm-compat-muted); }
    /* Harness desktop's Chromium supports a themed native picker, including its popup. */
    .dsh-llm-compat-settings .dsh-llm-compat-select, .dsh-llm-compat-settings .dsh-llm-compat-select::picker(select) { appearance: base-select; }
    .dsh-llm-compat-settings .dsh-llm-compat-select { display: flex; align-items: center; gap: 12px; cursor: pointer; }
    .dsh-llm-compat-settings .dsh-llm-compat-select::picker-icon { color: var(--dsh-llm-compat-muted); margin-left: auto; }
    .dsh-llm-compat-settings .dsh-llm-compat-select:open { border-color: var(--dsh-llm-compat-accent); }
    .dsh-llm-compat-settings .dsh-llm-compat-select::picker(select) { padding: 6px; margin-block: 4px; border: 1px solid var(--dsh-llm-compat-border); border-radius: 10px; background: var(--dsw-alias-bg-layer-1, #272b33); color: var(--dsh-llm-compat-text); box-shadow: 0 8px 24px #0003; backdrop-filter: blur(24px); max-height: min(320px, 60vh); overflow: auto; }
    .dsh-llm-compat-settings .dsh-llm-compat-select option { display: flex; align-items: center; gap: 12px; min-height: 38px; padding: 9px 12px; border-radius: 5px; font: inherit; cursor: pointer; }
    .dsh-llm-compat-settings .dsh-llm-compat-select option:checked { background: color-mix(in srgb, var(--dsh-llm-compat-accent) 16%, transparent); }
    .dsh-llm-compat-settings .dsh-llm-compat-select option:hover, .dsh-llm-compat-settings .dsh-llm-compat-select option:focus-visible { background: var(--dsw-alias-interactive-bg-hover, #343b48); outline: none; }
    .dsh-llm-compat-settings .dsh-llm-compat-select option::checkmark { order: 1; margin-left: auto; color: var(--dsh-llm-compat-accent); }
    .dsh-llm-compat-settings textarea { resize: vertical; min-height: 88px; }
    .dsh-llm-compat-settings .dsh-llm-compat-toggle { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin: 0 0 16px; cursor: pointer; }
    .dsh-llm-compat-settings .dsh-llm-compat-master .dsh-llm-compat-toggle { margin: 0; }
    .dsh-llm-compat-settings .dsh-llm-compat-toggle .dsh-llm-compat-label { margin: 0; }
    .dsh-llm-compat-settings .dsh-llm-compat-toggle[data-disabled="true"] { color: var(--dsh-llm-compat-muted); cursor: not-allowed; }
    .dsh-llm-compat-settings .dsh-llm-compat-switch { appearance: none; position: relative; flex: 0 0 36px; width: 36px; height: 21px; margin: 0; border: 1px solid var(--dsh-llm-compat-border); border-radius: 20px; background: var(--dsh-llm-compat-fill); cursor: pointer; }
    .dsh-llm-compat-settings .dsh-llm-compat-switch::after { content: ''; position: absolute; width: 13px; height: 13px; top: 3px; left: 3px; border-radius: 50%; background: var(--dsh-llm-compat-muted); }
    .dsh-llm-compat-settings .dsh-llm-compat-switch:checked { background: var(--dsh-llm-compat-accent); border-color: var(--dsh-llm-compat-accent); }
    .dsh-llm-compat-settings .dsh-llm-compat-switch:checked::after { transform: translateX(15px); background: #fff; }
    .dsh-llm-compat-settings .dsh-llm-compat-switch:disabled { opacity: .45; cursor: not-allowed; }
    .dsh-llm-compat-settings .dsh-llm-compat-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; padding-top: 4px; }
    .dsh-llm-compat-settings .dsh-llm-compat-save { border: 1px solid var(--dsh-llm-compat-border); border-radius: 8px; padding: 9px 18px; background: var(--dsh-llm-compat-fill); color: var(--dsh-llm-compat-text); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
    .dsh-llm-compat-settings .dsh-llm-compat-save:enabled:hover { background: var(--dsw-alias-interactive-bg-hover, #343b48); }
    .dsh-llm-compat-settings .dsh-llm-compat-save:disabled { opacity: .45; cursor: not-allowed; }
    .dsh-llm-compat-settings .dsh-llm-compat-status { margin: 0; flex: 1 1 220px; font-size: 12px; color: var(--dsh-llm-compat-muted); overflow-wrap: anywhere; }
    .dsh-llm-compat-settings .dsh-llm-compat-timeout { margin-top: 24px; }
  `
  const headers = [
    ['native', '原生（默认）'],
    ['claude-code', 'Claude Code'], ['codex', 'Codex'],
    ['pi', 'pi'], ['custom', '自定义'],
  ]
  const headerHelp = {
    native: '保留 Harness / SDK 原有的 User-Agent，适合无需更改客户端标识的接口。',
    'claude-code': '使用 Claude Code 的 User-Agent 标识；其他请求头保持原值，不附加 Claude 专属字段。',
    codex: '使用 Codex CLI 的 User-Agent 标识；其他请求头保持原值，仍使用当前渠道配置的模型与协议。',
    pi: '使用 pi 的 User-Agent 格式，包含当前操作系统和架构信息；其他请求头保持原值。',
    custom: '使用下方填写的 User-Agent 标识，适合接口明确要求特定值的情况；其他请求头保持原值。',
  }
  const recoveryHelp = {
    retry: '请求失败后按下方次数和间隔重试，次数耗尽后结束。开启不限次数时持续重试；手动停止会终止重试。',
    continue: '先按下方次数重试；仍失败时结束当前轮次，再按“重试耗尽后”的设置发送可见的继续消息。手动停止不会触发自动继续。',
  }

  // The current settings shell chooses icons by built-in section id and exposes
  // no icon option. Mark only our navigation row; leave the host bundle intact.
  function installNavigationIcon() {
    const marker = 'data-dsh-llm-compat-nav'
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4M21 13v3a2 2 0 0 1-2 2H3"/></svg>'
    const style = document.createElement('style')
    style.textContent = `
      [data-shortcut-modal="settings"] nav button[${marker}] > :first-child { display: none; }
      [data-shortcut-modal="settings"] nav button[${marker}]::before {
        content: ''; display: block; flex: 0 0 16px; width: 16px; height: 16px;
        background: currentColor; mask: url("data:image/svg+xml,${encodeURIComponent(svg)}") center / contain no-repeat;
      }
    `
    const mark = () => {
      for (const button of document.querySelectorAll('[data-shortcut-modal="settings"] nav button')) {
        button.toggleAttribute(marker, button.textContent.trim() === '模型请求控制')
      }
    }
    document.head.appendChild(style)
    const observer = new MutationObserver(mark)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    mark()
    return () => {
      observer.disconnect()
      style.remove()
      for (const button of document.querySelectorAll(`[${marker}]`)) button.removeAttribute(marker)
    }
  }

  function StreamTimeoutSettings({ ctx }) {
    const [view, setView] = useState(null)
    const [provider, setProvider] = useState('')
    const [drafts, setDrafts] = useState({})
    const [writable, setWritable] = useState(false)
    const [busy, setBusy] = useState(false)
    const [status, setStatus] = useState('正在读取模型渠道…')
    useEffect(() => {
      let active = true
      ctx.remote.settings.describe().then(result => {
        if (!active) return
        if (!result.ok) throw new Error(result.error.message)
        const row = result.value.namespaces.find(item => item.ns === 'llm-pi-ai')
        if (!row) { setStatus('未找到可配置的 pi-ai 模型渠道。'); return }
        setView(row)
        setProvider(Object.keys(row.value.providers)[0] ?? '')
        setWritable(result.value.writable)
        setStatus(result.value.writable ? '' : '当前配置只读')
      }).catch(error => { if (active) setStatus(error.message) })
      return () => { active = false }
    }, [ctx])
    const providers = view?.value.providers ?? {}
    const route = providers[provider]
    const savedMs = route?.streamIdleTimeoutMs ?? 300000
    const seconds = drafts[provider] ?? savedMs / 1000
    const milliseconds = Math.round(Number(seconds) * 1000)
    const valid = seconds !== '' && Number.isFinite(milliseconds) && milliseconds >= 1 && milliseconds <= 2147483647
    const dirty = Boolean(route) && valid && milliseconds !== savedMs
    const locked = busy || !writable
    const save = async event => {
      event.preventDefault()
      if (!dirty || locked) return
      setBusy(true); setStatus('正在保存超时…')
      try {
        // Send only this field: never round-trip redacted credentials or models.
        const result = await ctx.remote.settings.update(view.ns, { providers: { [provider]: { streamIdleTimeoutMs: milliseconds } } }, view.revision)
        if (!result.ok) throw new Error(result.error.message)
        setView(result.value)
        setDrafts(previous => { const next = { ...previous }; delete next[provider]; return next })
        setStatus('超时已保存；后续新模型调用生效，无需重启。正在进行的调用保持原值。')
      } catch (error) { setStatus(`超时保存失败：${error.message}。当前输入已保留；可重新打开此页读取最新配置。`) }
      finally { setBusy(false) }
    }
    return h('form', { className: 'dsh-llm-compat-timeout', 'aria-label': '流空闲超时设置', onSubmit: save },
      h('div', { className: 'dsh-llm-compat-card' },
        h('h3', {}, '流空闲超时'),
        h('p', { className: 'dsh-llm-compat-intro' }, '按模型渠道设置连续多久没有有效输出才终止请求。默认 300 秒（5 分钟），每次收到文字、思考或工具调用等输出后重新计时。'),
        route ? h('fieldset', { disabled: locked },
          h('div', { className: 'dsh-llm-compat-grid' },
            h('label', { className: 'dsh-llm-compat-field' },
              h('span', { className: 'dsh-llm-compat-label' }, '模型渠道'),
              h('select', { className: 'dsh-llm-compat-control dsh-llm-compat-select', 'aria-label': '超时设置的模型渠道', value: provider, disabled: locked, onChange: e => { setProvider(e.target.value); setStatus('') } },
                Object.entries(providers).map(([id, profile]) => h('option', { key: id, value: id }, profile.displayName ? `${profile.displayName}（${id}）` : id)))),
            h('label', { className: 'dsh-llm-compat-field' },
              h('span', { className: 'dsh-llm-compat-label' }, '流空闲超时（秒）'),
              h('input', { className: 'dsh-llm-compat-control', 'aria-label': '流空闲超时（秒）', 'aria-describedby': 'dsh-llm-compat-timeout-help', type: 'number', required: true, min: .001, max: 2147483.647, step: .001, value: seconds, disabled: locked, onChange: e => { const value = e.target.value; setDrafts(previous => ({ ...previous, [provider]: value })); setStatus('有未保存的超时修改') } }))),
          h('p', { id: 'dsh-llm-compat-timeout-help', className: 'dsh-llm-compat-help' }, '例如 600 秒为 10 分钟。此项是该渠道的原生超时，独立保存，不受上方请求控制总开关影响。'),
          h('div', { className: 'dsh-llm-compat-footer' },
            h('button', { type: 'submit', className: 'dsh-llm-compat-save', disabled: locked || !dirty }, busy ? '保存中…' : '保存超时'),
            h('p', { role: 'status', className: 'dsh-llm-compat-status', 'aria-live': 'polite' }, status || (Object.hasOwn(drafts, provider) ? '有未保存的超时修改' : '显示当前渠道已保存的超时'))))
          : h('p', { role: 'status', className: 'dsh-llm-compat-status' }, status || '尚未配置模型渠道，请先在模型设置中添加。')))
  }

  function Settings({ ctx }) {
    const [view, setView] = useState(null)
    const [draft, setDraft] = useState(null)
    const [writable, setWritable] = useState(false)
    const [status, setStatus] = useState('正在读取配置…')
    const [busy, setBusy] = useState(false)
    useEffect(() => {
      let active = true
      ctx.remote.settings.describe().then(result => {
        if (!active) return
        if (!result.ok) throw new Error(result.error.message)
        const row = result.value.namespaces.find(item => item.ns === 'llm-compat')
        if (!row) throw new Error('模型请求控制配置未加载，请确认插件已启用并重启 Harness。')
        setView(row); setDraft({ ...row.value }); setWritable(result.value.writable)
        setStatus(result.value.writable ? '' : '当前配置只读')
      }).catch(error => { if (active) setStatus(error.message) })
      return () => { active = false }
    }, [ctx])
    const change = (key, value) => { setDraft(previous => ({ ...previous, [key]: value })); setStatus('有未保存的修改') }
    const dirty = view && draft && Object.keys(draft).some(key => draft[key] !== view.value[key])
    const save = async event => {
      event.preventDefault()
      setBusy(true); setStatus('正在保存…')
      try {
        const patch = Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== view.value[key]))
        const result = await ctx.remote.settings.update(view.ns, patch, view.revision)
        if (!result.ok) throw new Error(result.error.message)
        setView(result.value); setDraft({ ...result.value.value })
        setStatus('已保存；后续请求使用新配置，无需重启。')
      } catch (error) { setStatus(`保存失败：${error.message}。可重新打开此页读取最新配置。`) }
      finally { setBusy(false) }
    }
    const locked = busy || !writable
    const optionsDisabled = locked || !draft?.enabled
    const unlimited = draft?.recoveryMode === 'retry' && draft.retryForever
    const noRetries = !unlimited && draft?.maxRetries === 0
    const noContinues = draft?.maxAutoContinues === 0
    const field = (key, label, control, help, disabled = optionsDisabled) => h('label', { key, className: 'dsh-llm-compat-field', 'data-disabled': disabled },
      h('span', { className: 'dsh-llm-compat-label' }, label), control,
      help && h('span', { id: `llm-compat-${key}-help`, className: 'dsh-llm-compat-help' }, help))
    const controlProps = (key, label, disabled = optionsDisabled) => ({
      'aria-label': label, 'aria-describedby': `llm-compat-${key}-help`, disabled, className: 'dsh-llm-compat-control', value: draft[key],
    })
    const select = (key, label, options, help) => field(key, label,
      h('select', { ...controlProps(key, label), className: 'dsh-llm-compat-control dsh-llm-compat-select', onChange: e => change(key, e.target.value) },
        options.map(([value, text]) => h('option', { key: value, value }, text))), help)
    const number = (key, label, min, max, step, help, disabled = optionsDisabled) => field(key, label,
      h('input', { ...controlProps(key, label, disabled), type: 'number', required: true, min, max, step, onChange: e => change(key, e.target.value === '' ? '' : Number(e.target.value)) }), help, disabled)
    const toggle = (key, label, help, disabled = optionsDisabled) => h('label', { key, className: 'dsh-llm-compat-toggle', 'data-disabled': disabled },
      h('span', {}, h('span', { className: 'dsh-llm-compat-label' }, label), h('span', { id: `llm-compat-${key}-help`, className: 'dsh-llm-compat-help' }, help)),
      h('input', { type: 'checkbox', role: 'switch', className: 'dsh-llm-compat-switch', 'aria-label': label, 'aria-describedby': `llm-compat-${key}-help`, disabled, checked: draft[key], onChange: e => change(key, e.target.checked) }))
    return h('section', { 'aria-label': '模型请求控制设置', className: 'dsh-llm-compat-settings' },
      h('style', {}, styles),
      h('h2', {}, '模型请求控制'),
      h('p', { className: 'dsh-llm-compat-intro' }, '设置请求身份与失败后的处理方式。保存后用于后续请求，无需重启。'),
      draft && h('form', { onSubmit: save }, h('fieldset', { disabled: locked },
        h('div', { className: 'dsh-llm-compat-master' }, toggle('enabled', '启用模型请求控制与统一重试', draft.enabled ? '统一管理请求头与重试策略。' : '已关闭：以下配置暂不使用，原有数值会保留。', locked)),
        h('div', { className: 'dsh-llm-compat-card' }, h('h3', {}, '请求身份'),
          select('headerMode', 'User-Agent 模式', headers, headerHelp[draft.headerMode]),
          draft.headerMode === 'custom' && field('customUserAgent', '自定义 User-Agent', h('input', {
            ...controlProps('customUserAgent', '自定义 User-Agent'), required: true, pattern: '[!-~][ -~]*',
            onChange: e => change('customUserAgent', e.target.value),
          }), '填写单行 ASCII 文本，例如 MyClient/1.0。')),
        h('div', { className: 'dsh-llm-compat-card' }, h('h3', {}, '失败处理'),
          select('recoveryMode', '恢复模式', [['retry', '连续重试'], ['continue', '重试耗尽后发送继续消息']], recoveryHelp[draft.recoveryMode]),
          draft.recoveryMode === 'retry' && toggle('retryForever', '不限重试次数', '持续尝试，直到成功或手动停止；下方次数上限不再生效。'),
          h('div', { className: 'dsh-llm-compat-grid' },
            number('maxRetries', '额外重试次数', 0, Number.MAX_SAFE_INTEGER, 1, unlimited ? '不限次数已开启，原有上限保留但不生效。' : '首次请求不计入。0 表示不重试。', optionsDisabled || unlimited),
            number('retryDelaySeconds', '每次重试等待（秒）', .1, 86400, 'any', noRetries ? '重试次数为 0，等待间隔暂不使用。' : '每次失败后等待，再发起下一次请求。', optionsDisabled || noRetries))),
        draft.recoveryMode === 'continue' && h('div', { className: 'dsh-llm-compat-card' }, h('h3', {}, '重试耗尽后'),
          h('div', { className: 'dsh-llm-compat-grid' },
          number('maxAutoContinues', '最多自动继续次数', 0, Number.MAX_SAFE_INTEGER, 1, '每条手动消息单独计数；成功完成后重置。0 表示不发送。'),
          number('continueDelaySeconds', '发送继续消息前等待（秒）', 0, 86400, 'any', noContinues ? '自动继续次数为 0，发送间隔暂不使用。' : '失败轮次结束后，等待多久再发送消息。', optionsDisabled || noContinues)),
          field('continueMessage', '继续消息内容', h('textarea', { ...controlProps('continueMessage', '继续消息内容', optionsDisabled || noContinues), rows: 3, onChange: e => change('continueMessage', e.target.value) }), noContinues ? '自动继续次数为 0，消息内容保留但不会发送。' : '作为可见的用户消息发送，附带插件来源与自动继续次数。', optionsDisabled || noContinues)),
        h('div', { className: 'dsh-llm-compat-footer' },
          h('button', { type: 'submit', disabled: !dirty || locked, className: 'dsh-llm-compat-save' }, busy ? '保存中…' : '保存配置'),
          h('p', { role: 'status', 'aria-live': 'polite', className: 'dsh-llm-compat-status' }, status || '配置已保存')))),
      !draft && h('p', { role: 'status', 'aria-live': 'polite', className: 'dsh-llm-compat-status' }, status),
      h(StreamTimeoutSettings, { ctx }))
  }

  return {
    inject: ['slots', 'remote', 'remote.settings'],
    apply(ctx) {
      ctx.effect(installNavigationIcon)
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section', id: 'llm-compat', order: 85, label: '模型请求控制',
      }, () => h(Settings, { ctx })))
    },
  }
} })
