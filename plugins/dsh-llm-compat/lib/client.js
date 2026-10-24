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
    .dsh-llm-compat-settings .dsh-llm-compat-provider-footer { margin-top: 18px; }
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

  function ProviderSettings({ ctx, configView, onConfigSaved, enabled, busy, setBusy }) {
    const [view, setView] = useState(null)
    const [provider, setProvider] = useState('')
    const [drafts, setDrafts] = useState({})
    const [writable, setWritable] = useState(false)
    const [status, setStatus] = useState('正在读取模型渠道…')
    useEffect(() => {
      let active = true
      ctx.remote.settings.describe().then(result => {
        if (!active) return
        if (!result.ok) throw new Error(result.error.message)
        const row = result.value.namespaces.find(item => item.ns === 'llm-pi-ai')
        if (!row) { setStatus('未找到可配置的模型渠道，请先在模型设置中添加。'); return }
        setView(row)
        setProvider(Object.keys(row.value.providers)[0] ?? '')
        setWritable(result.value.writable)
        setStatus(result.value.writable ? '' : '当前配置只读')
      }).catch(error => { if (active) setStatus(error.message) })
      return () => { active = false }
    }, [ctx])
    const providers = view?.value.providers ?? {}
    const route = providers[provider]
    const defaults = configView?.value ?? {}
    const savedHeader = defaults.providerHeaders?.[provider] ?? defaults
    const saved = {
      headerMode: savedHeader.headerMode ?? 'native',
      customUserAgent: savedHeader.customUserAgent ?? 'custom-client/1.0',
      seconds: (route?.streamIdleTimeoutMs ?? 300000) / 1000,
    }
    const draft = { ...saved, ...drafts[provider] }
    const milliseconds = Math.round(Number(draft.seconds) * 1000)
    const validTimeout = draft.seconds !== '' && Number.isFinite(milliseconds) && milliseconds >= 1 && milliseconds <= 2147483647
    const validHeader = draft.headerMode !== 'custom' || /^[\x21-\x7e][\x20-\x7e]*$/.test(draft.customUserAgent)
    const headerDirty = draft.headerMode !== saved.headerMode || draft.customUserAgent !== saved.customUserAgent
    const timeoutDirty = milliseconds !== saved.seconds * 1000
    const dirty = Boolean(route) && (headerDirty || timeoutDirty)
    const locked = busy || !writable || !configView
    const identityDisabled = locked || !enabled
    const change = (key, value) => {
      setDrafts(previous => ({ ...previous, [provider]: { ...previous[provider], [key]: value } }))
      setStatus('')
    }
    const save = async event => {
      event.preventDefault()
      if (!dirty || locked || !validTimeout || !validHeader) return
      setBusy(true); setStatus('正在保存当前渠道…')
      let headerSaved = false
      try {
        if (headerDirty) {
          const patch = { providerHeaders: { [provider]: { headerMode: draft.headerMode, customUserAgent: draft.customUserAgent } } }
          const result = await ctx.remote.settings.update(configView.ns, patch, configView.revision)
          if (!result.ok) throw new Error(result.error.message)
          onConfigSaved(result.value)
          headerSaved = true
        }
        if (timeoutDirty) {
          // Never round-trip redacted credentials, models, or another channel.
          const result = await ctx.remote.settings.update(view.ns, { providers: { [provider]: { streamIdleTimeoutMs: milliseconds } } }, view.revision)
          if (!result.ok) throw new Error(result.error.message)
          setView(result.value)
        }
        setDrafts(previous => { const next = { ...previous }; delete next[provider]; return next })
        setStatus('渠道配置已保存；后续请求生效，无需重启。进行中的调用保持原超时。')
      } catch (error) {
        setStatus((headerSaved ? 'User-Agent 已保存，流空闲超时保存失败：' : '渠道配置保存失败：') + error.message + '。未保存的输入已保留；可重新打开此页读取最新配置。')
      } finally { setBusy(false) }
    }
    const field = (label, control, help, id, disabled = locked) => h('label', { className: 'dsh-llm-compat-field', 'data-disabled': disabled },
      h('span', { className: 'dsh-llm-compat-label' }, label), control,
      help && h('span', { id, className: 'dsh-llm-compat-help' }, help))
    return h('form', { className: 'dsh-llm-compat-provider dsh-llm-compat-card', 'aria-label': '渠道请求设置', onSubmit: save },
      h('h3', {}, '渠道请求配置'),
      h('p', { className: 'dsh-llm-compat-intro' }, '选择模型渠道，分别设置它的请求身份和流空闲超时。切换渠道会保留未保存的输入。'),
      route ? h('fieldset', { disabled: locked },
        field('模型渠道', h('select', { className: 'dsh-llm-compat-control dsh-llm-compat-select', 'aria-label': '模型渠道', value: provider, disabled: locked, onChange: e => { setProvider(e.target.value); setStatus('') } },
          Object.entries(providers).map(([id, profile]) => h('option', { key: id, value: id }, profile.displayName ? profile.displayName + '（' + id + '）' : id)))),
        h('div', { className: 'dsh-llm-compat-grid' },
          field('User-Agent 模式', h('select', { className: 'dsh-llm-compat-control dsh-llm-compat-select', 'aria-label': 'User-Agent 模式', 'aria-describedby': 'llm-compat-headerMode-help', value: draft.headerMode, disabled: identityDisabled, onChange: e => change('headerMode', e.target.value) },
            headers.map(([value, text]) => h('option', { key: value, value }, text))), headerHelp[draft.headerMode], 'llm-compat-headerMode-help', identityDisabled),
          field('流空闲超时（秒）', h('input', { className: 'dsh-llm-compat-control', 'aria-label': '流空闲超时（秒）', 'aria-describedby': 'dsh-llm-compat-timeout-help', type: 'number', required: true, min: .001, max: 2147483.647, step: .001, value: draft.seconds, disabled: locked, onChange: e => change('seconds', e.target.value) }),
            '连续没有有效输出的等待上限。默认 300 秒；600 秒为 10 分钟。收到有效输出后重新计时。', 'dsh-llm-compat-timeout-help')),
        draft.headerMode === 'custom' && field('自定义 User-Agent', h('input', {
          className: 'dsh-llm-compat-control', 'aria-label': '自定义 User-Agent', required: true, pattern: '[!-~][ -~]*', value: draft.customUserAgent, disabled: identityDisabled,
          onChange: e => change('customUserAgent', e.target.value),
        }), '仅用于当前渠道。填写单行 ASCII 文本，例如 MyClient/1.0。', undefined, identityDisabled),
        !enabled && h('p', { className: 'dsh-llm-compat-help' }, '请求控制已关闭，User-Agent 设置暂不生效；流空闲超时仍可编辑并生效。'),
        !defaults.providerHeaders?.[provider] && saved.headerMode !== 'native' && h('p', { className: 'dsh-llm-compat-help' }, '当前沿用升级前的默认身份。修改并保存后，仅对这个渠道生效。'),
        h('div', { className: 'dsh-llm-compat-footer dsh-llm-compat-provider-footer' },
          h('button', { type: 'submit', className: 'dsh-llm-compat-save', disabled: locked || !dirty || !validTimeout || !validHeader }, busy ? '保存中…' : '保存渠道配置'),
          h('p', { role: 'status', className: 'dsh-llm-compat-status', 'aria-live': 'polite' }, status || (dirty ? '当前渠道有未保存的修改' : '当前渠道的配置已保存'))))
        : h('p', { role: 'status', className: 'dsh-llm-compat-status' }, status || '尚未配置模型渠道，请先在模型设置中添加。'))
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
    const globalKeys = ['enabled', 'recoveryMode', 'maxRetries', 'retryDelaySeconds', 'retryForever', 'maxAutoContinues', 'continueDelaySeconds', 'continueMessage']
    const dirty = view && draft && globalKeys.some(key => draft[key] !== view.value[key])
    const save = async event => {
      event.preventDefault()
      if (!dirty || locked) return
      setBusy(true); setStatus('正在保存…')
      try {
        const patch = Object.fromEntries(globalKeys.filter(key => draft[key] !== view.value[key]).map(key => [key, draft[key]]))
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
      h(ProviderSettings, { ctx, configView: view, onConfigSaved: setView, enabled: draft?.enabled ?? true, busy, setBusy }),
      draft && h('form', { 'aria-label': '全局重试设置', onSubmit: save }, h('fieldset', { disabled: locked },
        h('div', { className: 'dsh-llm-compat-master' }, toggle('enabled', '启用模型请求控制与统一重试', draft.enabled ? '作用于渠道身份与全局重试；流空闲超时独立生效。' : '已关闭：身份与重试暂不生效，原有配置保留。流空闲超时不受影响。', locked)),
        h('div', { className: 'dsh-llm-compat-card' }, h('h3', {}, '全局失败处理'),
          h('p', { className: 'dsh-llm-compat-intro' }, '以下重试与自动继续策略适用于所有模型渠道。'),
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
          h('button', { type: 'submit', disabled: !dirty || locked, className: 'dsh-llm-compat-save' }, busy ? '保存中…' : '保存全局配置'),
          h('p', { role: 'status', 'aria-live': 'polite', className: 'dsh-llm-compat-status' }, status || '配置已保存')))),
      !draft && h('p', { role: 'status', 'aria-live': 'polite', className: 'dsh-llm-compat-status' }, status))
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
