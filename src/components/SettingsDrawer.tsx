import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Loader2, PlugZap, X } from 'lucide-react'
import {
  TONES,
  discoverModelOptions,
  fetchGatewaySettings,
  fetchModelOptions,
  saveGatewaySettings,
  testGateway,
  type GatewaySettings,
  type Tone,
} from '../lib/settings'

const CUSTOM_MODEL = '__custom__'

interface Props {
  open: boolean
  onClose: () => void
  tone: Tone
  onTone: (tone: Tone) => void
}

export function SettingsDrawer({ open, onClose, tone, onTone }: Props) {
  const [gateway, setGateway] = useState<GatewaySettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [busy, setBusy] = useState<'save' | 'test' | 'clear' | ''>('')
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null)
  const [modelOptions, setModelOptions] = useState<string[]>([])
  const [customModel, setCustomModel] = useState(false)
  const [modelsBusy, setModelsBusy] = useState(false)
  const [modelsNote, setModelsNote] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setLoadError('')
    setFeedback(null)
    setApiKey('')
    setModelOptions([])
    setCustomModel(false)
    setModelsBusy(false)
    setModelsNote('')

    const load = async () => {
      try {
        const data = await fetchGatewaySettings()
        if (cancelled) return
        setGateway(data)
        setBaseUrl(data.baseUrl)
        setModel(data.model)
        setLoading(false)

        try {
          const cached = await fetchModelOptions()
          if (cancelled) return
          if (cached.models.length) {
            setModelOptions(cached.models)
            setModelsNote(`已确认 ${cached.models.length} 个可用模型。`)
            return
          }
          if (!data.configured) return
          setModelsBusy(true)
          const found = await discoverModelOptions({})
          if (cancelled) return
          if (found.models.length) setModelOptions(found.models)
          setModelsNote(found.message)
        } catch {
          /* model discovery is optional — keep the manual option */
        } finally {
          if (!cancelled) setModelsBusy(false)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : '无法读取网关设置')
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [open])

  const refreshModels = async () => {
    setModelsBusy(true)
    setModelsNote('')
    try {
      const found = await discoverModelOptions({
        baseUrl,
        model,
        apiKey: apiKey.trim() || undefined,
      })
      if (found.models.length) setModelOptions(found.models)
      setModelsNote(found.message)
    } catch (error) {
      setModelsNote(error instanceof Error ? error.message : '读取模型列表失败')
    } finally {
      setModelsBusy(false)
    }
  }

  const save = async () => {
    setBusy('save')
    setFeedback(null)
    try {
      const next = await saveGatewaySettings({
        baseUrl,
        model,
        apiKey: apiKey.trim() ? apiKey.trim() : undefined,
      })
      setGateway(next)
      setApiKey('')
      setFeedback({ ok: true, text: next.configured ? '已保存，网关可用。' : '已保存，但尚未配置完整。' })
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : '保存失败' })
    } finally {
      setBusy('')
    }
  }

  const clearKey = async () => {
    if (!window.confirm('清除已保存的密钥？服务端将回退到 .env 中的配置。')) return
    setBusy('clear')
    setFeedback(null)
    try {
      const next = await saveGatewaySettings({ baseUrl, model, clearKey: true })
      setGateway(next)
      setFeedback({ ok: true, text: '密钥已清除。' })
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : '清除失败' })
    } finally {
      setBusy('')
    }
  }

  const test = async () => {
    setBusy('test')
    setFeedback(null)
    try {
      const result = await testGateway()
      setFeedback({ ok: result.ok, text: result.message })
    } catch (error) {
      setFeedback({ ok: false, text: error instanceof Error ? error.message : '测试失败' })
    } finally {
      setBusy('')
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.32, ease: [0.2, 0.8, 0.25, 1] }}
            aria-label="设置"
          >
            <div className="drawer-head">
              <h3 className="drawer-title">设置</h3>
              <button type="button" className="icon-only" aria-label="关闭" onClick={onClose}>
                <X size={17} strokeWidth={1.5} />
              </button>
            </div>

            <div className="drawer-body">
              <section className="settings-section">
                <h4 className="settings-label">解读语气</h4>
                <p className="settings-hint">只影响下一次 AI 解读，已生成的记录不会改变。</p>
                <div className="tone-grid" role="radiogroup" aria-label="解读语气">
                  {TONES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={tone === option.id}
                      className={`tone-option${tone === option.id ? ' active' : ''}`}
                      onClick={() => onTone(option.id)}
                    >
                      <span className="tone-name">
                        {option.label}
                        {tone === option.id && <Check size={12} strokeWidth={2} />}
                      </span>
                      <span className="tone-desc">{option.desc}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="settings-section">
                <h4 className="settings-label">解读网关</h4>
                <p className="settings-hint">
                  兼容 OpenAI 接口。密钥只保存在服务端，不会下发到浏览器。
                </p>

                {loading ? (
                  <p className="settings-hint">读取中…</p>
                ) : loadError ? (
                  <p className="settings-error">{loadError}</p>
                ) : (
                  <div className="settings-form">
                    <label className="settings-field">
                      <span>接口地址</span>
                      <input
                        className="settings-input"
                        value={baseUrl}
                        onChange={(e) => setBaseUrl(e.target.value)}
                        placeholder="https://example.com/v1"
                        spellCheck={false}
                        autoComplete="off"
                      />
                    </label>
                    <div className="settings-field">
                      <span>
                        模型
                        <button
                          type="button"
                          className="mini-link"
                          onClick={refreshModels}
                          disabled={modelsBusy}
                        >
                          {modelsBusy ? '读取中…' : '刷新列表'}
                        </button>
                      </span>

                      {customModel ? (
                        <div className="settings-custom-model">
                          <input
                            className="settings-input"
                            aria-label="自定义模型名"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            placeholder="输入网关支持的模型名"
                            spellCheck={false}
                            autoComplete="off"
                          />
                          <button
                            type="button"
                            className="mini-link"
                            onClick={() => setCustomModel(false)}
                          >
                            从列表选择
                          </button>
                        </div>
                      ) : (
                        <div className="settings-select-wrap">
                          <select
                            className="settings-input settings-select"
                            aria-label="模型"
                            value={model}
                            onChange={(e) => {
                              if (e.target.value === CUSTOM_MODEL) setCustomModel(true)
                              else setModel(e.target.value)
                            }}
                          >
                            {!model && <option value="">（使用服务端默认模型）</option>}
                            {model && !modelOptions.includes(model) && (
                              <option value={model}>{model}（当前）</option>
                            )}
                            {modelOptions.map((id) => (
                              <option key={id} value={id}>
                                {id}
                              </option>
                            ))}
                            <option value={CUSTOM_MODEL}>自定义模型…</option>
                          </select>
                          <ChevronDown size={14} strokeWidth={1.6} aria-hidden="true" />
                        </div>
                      )}

                      {modelsNote && <span className="settings-models-note">{modelsNote}</span>}
                    </div>
                    <label className="settings-field">
                      <span>
                        密钥
                        {gateway?.hasKey && (
                          <em className="settings-keyhint">
                            已保存 {gateway.keyHint}
                            {gateway.keySource === 'env' ? '（来自 .env）' : ''}
                          </em>
                        )}
                      </span>
                      <input
                        className="settings-input"
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={gateway?.hasKey ? '留空则保持现有密钥' : '粘贴 API Key'}
                        autoComplete="off"
                      />
                    </label>

                    {feedback && (
                      <p className={feedback.ok ? 'settings-feedback ok' : 'settings-feedback bad'}>
                        {feedback.text}
                      </p>
                    )}

                    <div className="settings-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={save}
                        disabled={busy !== ''}
                      >
                        {busy === 'save' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                        保存
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={test}
                        disabled={busy !== ''}
                      >
                        {busy === 'test' ? <Loader2 size={14} className="spin" /> : <PlugZap size={14} />}
                        测试连接
                      </button>
                      {gateway?.keySource === 'settings' && (
                        <button
                          type="button"
                          className="mini-link"
                          onClick={clearKey}
                          disabled={busy !== ''}
                        >
                          清除已保存密钥
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <p className="settings-note">
                网关改动即时生效，无需重启服务。若上游不可用，解读会自动回退到本地牌义。
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}