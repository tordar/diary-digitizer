'use client'
import { useEffect, useState } from 'react'

interface Settings {
  ai_provider: string
  ollama_url: string
  ollama_model: string
  anthropic_api_key: string
  anthropic_model: string
  confidence_threshold: string
  prompt_template: string
  default_language: string
}

const DEFAULTS: Settings = {
  ai_provider: 'ollama',
  ollama_url: '',
  ollama_model: '',
  anthropic_api_key: '',
  anthropic_model: 'claude-opus-4-6',
  confidence_threshold: '',
  prompt_template: '',
  default_language: '',
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((data) => setSettings({ ...DEFAULTS, ...data }))
  }, [])

  const save = async () => {
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const set = (key: keyof Settings, value: string) =>
    setSettings((s) => s ? { ...s, [key]: value } : s)

  if (!settings) return <div className="p-8 text-slate-400">Laster...</div>

  const field = (key: keyof Settings, label: string, hint: string, opts: { multiline?: boolean; password?: boolean } = {}) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {opts.multiline ? (
        <textarea
          value={settings[key]}
          onChange={(e) => set(key, e.target.value)}
          rows={12}
          className="rounded border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-200 focus:border-slate-500 focus:outline-none"
        />
      ) : (
        <input
          type={opts.password ? 'password' : 'text'}
          value={settings[key]}
          onChange={(e) => set(key, e.target.value)}
          className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-slate-500 focus:outline-none"
        />
      )}
      <p className="text-[11px] text-slate-600">{hint}</p>
    </div>
  )

  return (
    <div className="mx-auto max-w-xl p-8">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Innstillinger</h1>
      <div className="flex flex-col gap-5">

        {/* Provider toggle */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-400">AI-leverandør</label>
          <div className="flex gap-2">
            {(['ollama', 'anthropic'] as const).map((p) => (
              <button
                key={p}
                onClick={() => set('ai_provider', p)}
                className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
                  settings.ai_provider === p
                    ? 'bg-violet-700 text-white'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                {p === 'ollama' ? 'Ollama (lokal)' : 'Anthropic (sky)'}
              </button>
            ))}
          </div>
        </div>

        {settings.ai_provider === 'ollama' ? (
          <>
            {field('ollama_url', 'Ollama URL', 'F.eks. http://localhost:11434 eller http://host.docker.internal:11434')}
            {field('ollama_model', 'Ollama-modell', 'F.eks. qwen2.5vl:7b')}
          </>
        ) : (
          <>
            {field('anthropic_api_key', 'Anthropic API-nøkkel', 'Starter med sk-ant-...', { password: true })}
            {field('anthropic_model', 'Anthropic-modell', 'F.eks. claude-opus-4-6 eller claude-sonnet-4-6')}
          </>
        )}

        {field('confidence_threshold', 'Sikkerhetsterskelen', 'Oppføringer under denne verdien (0.0–1.0) går til gjennomgang')}
        {field('default_language', 'Standardspråk', 'Språkkode for transkripsjoner, f.eks. "no" (norsk), "en" (engelsk)')}
        {field('prompt_template', 'AI-prompt', 'Skriv "default" for å bruke standardpromptet, eller lim inn din egen', { multiline: true })}

        <button
          onClick={save}
          className="self-start rounded bg-violet-700 px-6 py-2 text-sm text-white hover:bg-violet-600"
        >
          {saved ? '✓ Lagret' : 'Lagre'}
        </button>
      </div>
    </div>
  )
}
