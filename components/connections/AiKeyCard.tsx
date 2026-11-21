"use client";

import { useId, useState, type FormEvent } from "react";
import { callApi, errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import type { AiKeyView, ConnectionsResponse, SaveAiKeyRequest } from "@/lib/api/contract";
import { AI_PROVIDER_COPY, AI_PROVIDERS, isAiProvider, type AiProviderId } from "@/lib/domain/connections";
import styles from "./connections.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The owner's own AI key on the Connections page: which provider and key end
// Anchored writes drafts with, or what writes them until there is one. The
// form picks one of the named providers, takes the key and, for every
// provider but Anthropic, the model's name, and Check and save sends them to
// the AI key route, which checks the key with one short call before saving
// it. The key never comes back: the card shows its provider and last four
// characters. A visitor who can't connect sees the card without the form.

/** Props for `AiKeyCard`. */
interface AiKeyCardProps {
  readonly businessId: string;
  readonly view: AiKeyView;
  /** Whether this visitor may save a key. The reason they can't is shown once, above every card. */
  readonly canChange: boolean;
}

/** Return the AI key route for `businessId`. */
function aiKeyUrl(businessId: string): string {
  return `/api/businesses/${encodeURIComponent(businessId)}/ai-key`;
}

/** Read the text field `name` from a submitted form. */
function field(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** The status line: the saved key's provider, key end and model, or that there is none. */
function statusOf(view: AiKeyView): string {
  if (view.provider === null) return "No key yet";
  const key = view.lastFour === null ? "" : ` ending in ${view.lastFour}`;
  const model = view.model === null ? "" : `, model ${view.model}`;
  return `Connected: ${AI_PROVIDER_COPY[view.provider].name} key${key}${model}`;
}

/** Render the owner's AI key: its status, what writes drafts without one, and the form that saves one. */
export function AiKeyCard({ businessId, view: initial, canChange }: AiKeyCardProps) {
  const titleId = useId();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = view.provider !== null;
  const showForm = canChange && view.unavailable === null;

  /** Send one change and show the key the route answers with, or its error. */
  async function change(send: () => Promise<ConnectionsResponse>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      setView((await send()).ai);
      return true;
    } catch (failure) {
      setError(errorText(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const provider = field(data, "provider");
    if (!isAiProvider(provider)) return;
    const model = field(data, "model");
    const body: SaveAiKeyRequest = { provider, apiKey: field(data, "apiKey"), ...(model === "" ? {} : { model }) };
    if (await change(() => callApi<ConnectionsResponse>(aiKeyUrl(businessId), "PUT", body))) form.reset();
  }

  return (
    <section className={`panel ${styles.service}`} aria-labelledby={titleId}>
      <h3 id={titleId} className="panel-title">
        Your AI key
      </h3>
      <p className={styles.does}>Anchored writes your drafts and chat replies with AI on your own account, so your provider bills you directly. You still approve every draft.</p>
      <p className={connected ? styles.on : styles.off}>{statusOf(view)}</p>
      {!connected && (
        <p className={styles.does}>
          {view.fallback === "server" ? "Until you add one, Anchored writes drafts with this server's AI." : "Until you add one, Anchored writes drafts from its own templates."}
        </p>
      )}

      <div className={styles.foot}>
        {view.unavailable !== null && <p className={styles.reason}>{view.unavailable}</p>}
        {showForm && <AiKeyForm connected={connected} saved={view.provider} busy={busy} onSubmit={onSave} />}
        {canChange && connected && (
          <div className={styles.acts}>
            <Button variant="quiet" size="sm" onClick={() => void change(() => callApi<ConnectionsResponse>(aiKeyUrl(businessId), "DELETE"))} disabled={busy}>
              Remove key
            </Button>
          </div>
        )}
        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

/** Render the form that checks and saves a key. Once one is saved, it waits behind a disclosure. */
function AiKeyForm({
  connected,
  saved,
  busy,
  onSubmit,
}: {
  readonly connected: boolean;
  readonly saved: AiProviderId | null;
  readonly busy: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const providerId = useId();
  const keyId = useId();
  const modelId = useId();
  const [provider, setProvider] = useState<AiProviderId>(saved ?? "anthropic");
  const copy = AI_PROVIDER_COPY[provider];

  const form = (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={`${styles.fields} ${styles.wideFields}`}>
        <div className={styles.field}>
          <label htmlFor={providerId}>Provider</label>
          <select id={providerId} name="provider" className={styles.input} value={provider} onChange={(event) => isAiProvider(event.target.value) && setProvider(event.target.value)}>
            {AI_PROVIDERS.map((id) => (
              <option key={id} value={id}>
                {AI_PROVIDER_COPY[id].name}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor={keyId}>API key</label>
          <input id={keyId} name="apiKey" type="password" required autoComplete="off" spellCheck={false} className={styles.input} />
          <small className={styles.hint}>{copy.keyHint} Anchored stores it encrypted.</small>
        </div>
        <div className={styles.field}>
          <label htmlFor={modelId}>Model</label>
          <input id={modelId} name="model" type="text" required={copy.needsModel} autoComplete="off" spellCheck={false} className={styles.input} />
          <small className={styles.hint}>{copy.needsModel ? `Copy the model's exact name from ${copy.name}.` : "Optional. Leave it blank and Anchored picks a Claude model for each job."}</small>
        </div>
      </div>
      <div className={styles.acts}>
        <Button type="submit" disabled={busy}>
          {busy ? "Checking your key" : "Check and save"}
        </Button>
      </div>
    </form>
  );
  if (!connected) return form;
  return (
    <details className={styles.change}>
      <summary>Use a different key</summary>
      {form}
    </details>
  );
}
