import { useEffect, useState } from "react";
import { aiRequest } from "../api";
import type { AiSettings } from "../api";

export function AiSettingsPanel() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    let active = true;
    aiRequest<AiSettings>("load").then((value) => {
      if (active) setSettings(value);
    }).catch(() => {
      if (active) setStatus("Unable to load AI settings. Open the desktop app and check Python is installed.");
    });
    return () => { active = false; };
  }, []);

  async function save() {
    if (!settings || busy) return;
    setBusy(true);
    setStatus("");
    try {
      const saved = await aiRequest<AiSettings>("save", { ...settings, apiKey, clearApiKey });
      setSettings(saved);
      setApiKey("");
      setClearApiKey(false);
      setStatus("AI settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save AI settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel settings-section-panel">
      <div className="panel-header"><h3>AI Description</h3></div>
      <p className="muted">Use an OpenAI-compatible service with a vision-capable model. Images are sent when you confirm Generate Description or click Generate Tags.</p>
      {settings ? (
        <fieldset className="ai-settings-fields" disabled={busy}>
          <label><span>API endpoint</span>
            <input type="url" value={settings.endpoint} onChange={(event) => setSettings({ ...settings, endpoint: event.target.value })} placeholder="https://api.openai.com/v1/chat/completions" />
          </label>
          <label><span>Model</span>
            <input value={settings.model} onChange={(event) => setSettings({ ...settings, model: event.target.value })} placeholder="Vision model ID from your provider" />
          </label>
          <label><span>API key {settings.hasApiKey ? "(stored)" : "(not configured)"}</span>
            <input type="password" autoComplete="new-password" spellCheck={false} value={apiKey} disabled={clearApiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={settings.hasApiKey ? "Leave blank to keep stored key" : "Enter API key"} />
          </label>
          <p className="muted">The key is encrypted for your Windows account. Re-enter it when changing providers.</p>
          {settings.hasApiKey ? <label className="checkbox-row"><span>Remove stored key on save</span><input type="checkbox" checked={clearApiKey} onChange={(event) => setClearApiKey(event.target.checked)} /></label> : null}
          <label><span>Description instructions</span>
            <textarea rows={5} value={settings.prompt} onChange={(event) => setSettings({ ...settings, prompt: event.target.value })} />
          </label>
          <label className="checkbox-row">
            <span>Apply Ai-generated tags immediately</span>
            <input type="checkbox" checked={settings.applyAiGeneratedTagsImmediately ?? false} onChange={event => setSettings({ ...settings, applyAiGeneratedTagsImmediately: event.target.checked })} />
          </label>
          <p className="muted">Supports JPEG, PNG, and WebP up to 20 MB. Export RAW images first.</p>
          <div className="action-row"><button type="button" onClick={() => void save()}>{busy ? "Saving..." : "Save AI Settings"}</button></div>
        </fieldset>
      ) : <p className="muted">{status ? "AI settings unavailable." : "Loading AI settings..."}</p>}
      <p role="status">{status}</p>
    </section>
  );
}
