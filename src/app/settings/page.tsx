'use client'
import { useEffect, useState } from 'react'

interface Settings {
  ollama_url: string
  ollama_model: string
  confidence_threshold: string
  prompt_template: string
  default_language: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then(setSettings)
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

  if (!settings) return <div className="p-8 text-slate-400">Laster...</div>

  const field = (key: keyof Settings, label: string, hint: string, multiline = false) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-slate-400">{label}</label>
      {multiline ? (
        <textarea
          value={settings[key]}
          onChange={(e) => setSettings((s) => s ? { ...s, [key]: e.target.value } : s)}
          rows={12}
          className="rounded border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-xs text-slate-200 focus:border-slate-500 focus:outline-none"
        />
      ) : (
        <input
          value={settings[key]}
          onChange={(e) => setSettings((s) => s ? { ...s, [key]: e.target.value } : s)}
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
        {field('ollama_url', 'Ollama URL', 'F.eks. http://localhost:11434 eller http://host.docker.internal:11434')}
        {field('ollama_model', 'Ollama-modell', 'F.eks. qwen2.5vl:7b')}
        {field('confidence_threshold', 'Sikkerhetsterskelen', 'Oppføringer under denne verdien (0.0–1.0) går til gjennomgang')}
        {field('default_language', 'Standardspråk', 'Språkkode for transkripsjoner, f.eks. "no" (norsk), "en" (engelsk)')}
        {field('prompt_template', 'AI-prompt', 'Skriv "default" for å bruke standardpromptet, eller lim inn din egen', true)}
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
