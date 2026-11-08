"use client";

import Link from "next/link";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { copyText } from "@/components/business/SendYourself";
import { callApi, errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import type { ConnectionsResponse, ConnectionView, ConnectRequest } from "@/lib/api/contract";
import { CONNECTION_COPY, type ConnectionKind } from "@/lib/domain/connections";
import styles from "./connections.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The services on the Connections page, one block each: what the service does,
// whether it is connected, the form that connects it, and the addresses the
// owner pastes into the service's own settings, each with Copy. A service this
// server can't offer shows why and no form. A visitor who can't connect, such
// as a guest, sees the reason once at the top and no forms at all.

/** Props for `ConnectionsPanel`. */
export interface ConnectionsPanelProps {
  readonly businessId: string;
  /** Why this visitor can't connect services, or `null` when they can. */
  readonly blocked: string | null;
  /** Where the visitor goes to fix `blocked`, such as setting up their own business. */
  readonly blockedLink?: { readonly href: string; readonly label: string };
  readonly connections: readonly ConnectionView[];
}

/** Return the connections route for `businessId`. */
function connectionsUrl(businessId: string): string {
  return `/api/businesses/${encodeURIComponent(businessId)}/connections`;
}

/** Read the text field `name` from a submitted form. */
function field(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Build the connect request for `kind` from its submitted form. */
function requestFrom(kind: ConnectionKind, data: FormData): ConnectRequest {
  switch (kind) {
    case "texting": {
      const forwardTo = field(data, "forwardTo");
      return {
        kind,
        accountSid: field(data, "accountSid"),
        authToken: field(data, "authToken"),
        phone: field(data, "phone"),
        ...(forwardTo === "" ? {} : { forwardTo }),
      };
    }
    case "email-out":
      return { kind, replyTo: field(data, "replyTo") };
    case "email-in":
      return { kind };
    case "stripe":
      return { kind, signingSecret: field(data, "signingSecret") };
  }
}

/** Render the services, each with its status, its form and its setup addresses. */
export function ConnectionsPanel({ businessId, blocked, blockedLink, connections }: ConnectionsPanelProps) {
  const [views, setViews] = useState(connections);
  const [busy, setBusy] = useState<ConnectionKind | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ConnectionKind, string>>>({});

  /** Send one change for `kind` and show the services the route answers with, or its error. */
  async function change(kind: ConnectionKind, send: () => Promise<ConnectionsResponse>): Promise<boolean> {
    setBusy(kind);
    setErrors((current) => ({ ...current, [kind]: undefined }));
    try {
      setViews((await send()).connections);
      return true;
    } catch (error) {
      setErrors((current) => ({ ...current, [kind]: errorText(error) }));
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function onConnect(kind: ConnectionKind, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = requestFrom(kind, new FormData(form));
    if (await change(kind, () => callApi<ConnectionsResponse>(connectionsUrl(businessId), "PUT", body))) form.reset();
  }

  function onDisconnect(kind: ConnectionKind) {
    void change(kind, () => callApi<ConnectionsResponse>(`${connectionsUrl(businessId)}?kind=${kind}`, "DELETE"));
  }

  return (
    <div className={styles.stack}>
      {blocked !== null && (
        <p className={styles.blocked}>
          {blocked}
          {blockedLink !== undefined && (
            <>
              {" "}
              <Link href={blockedLink.href}>{blockedLink.label}</Link>
            </>
          )}
        </p>
      )}
      <div className={styles.services}>
        {views.map((view) => (
          <ServiceBlock
            key={view.kind}
            view={view}
            canChange={blocked === null}
            busy={busy === view.kind}
            error={errors[view.kind] ?? null}
            onConnect={(event) => onConnect(view.kind, event)}
            onDisconnect={() => onDisconnect(view.kind)}
          />
        ))}
      </div>
    </div>
  );
}

/** Render one service: what it does, its status, then its form or the reason it isn't offered. */
function ServiceBlock({
  view,
  canChange,
  busy,
  error,
  onConnect,
  onDisconnect,
}: {
  readonly view: ConnectionView;
  readonly canChange: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onConnect: (event: FormEvent<HTMLFormElement>) => void;
  readonly onDisconnect: () => void;
}) {
  const titleId = useId();
  const copy = CONNECTION_COPY[view.kind];
  const status = view.connected ? (view.detail === null ? "Connected" : `Connected to ${view.detail}`) : "Not connected";
  const showForm = canChange && view.unavailable === null;

  return (
    <section className={`panel ${styles.service}`} aria-labelledby={titleId}>
      <h3 id={titleId} className="panel-title">
        {copy.name}
      </h3>
      <p className={styles.does}>{copy.does}</p>
      <p className={view.connected ? styles.on : styles.off}>{status}</p>
      {!view.connected && <p className={styles.does}>{copy.until}</p>}
      {view.unavailable !== null && <p className={styles.reason}>{view.unavailable}</p>}

      {view.setup.length > 0 && (
        <div className={styles.setup}>
          {view.setup.map((item) => (
            <SetupValue key={item.label} label={item.label} value={item.value} />
          ))}
        </div>
      )}

      {showForm && <ConnectForm kind={view.kind} connected={view.connected} busy={busy} onSubmit={onConnect} />}

      {canChange && view.connected && (
        <div className={styles.acts}>
          <Button variant="quiet" size="sm" onClick={onDisconnect} disabled={busy}>
            Disconnect
          </Button>
        </div>
      )}
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

/** Render one labelled text box. */
function TextField({ name, label, type = "text", placeholder, hint, required = true }: { readonly name: string; readonly label: string; readonly type?: "text" | "password" | "email" | "tel"; readonly placeholder?: string; readonly hint?: ReactNode; readonly required?: boolean }) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type={type} required={required} placeholder={placeholder} autoComplete="off" spellCheck={false} className={styles.input} />
      {hint !== undefined && <small className={styles.hint}>{hint}</small>}
    </div>
  );
}

/** Render the form that connects `kind`. */
function ConnectForm({
  kind,
  connected,
  busy,
  onSubmit,
}: {
  readonly kind: ConnectionKind;
  readonly connected: boolean;
  readonly busy: boolean;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const verb = connected ? "Reconnect" : "Connect";
  if (kind === "email-in") {
    // Connected already means an address is on screen; a new one would stop the old one working.
    if (connected) return null;
    return (
      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.acts}>
          <Button type="submit" disabled={busy}>
            Get my forwarding address
          </Button>
        </div>
      </form>
    );
  }
  const form = (
    <form className={styles.form} onSubmit={onSubmit}>
      <div className={styles.fields}>
        {kind === "texting" && (
          <>
            <TextField name="accountSid" label="Account SID" placeholder="AC..." hint="On your Twilio console's home page." />
            <TextField name="authToken" label="Auth token" type="password" hint="Next to the Account SID. Anchored stores it encrypted." />
            <TextField name="phone" label="Twilio number" type="tel" placeholder="+1 301 555 0192" />
            <TextField name="forwardTo" label="Phone to ring first" type="tel" placeholder="+1 301 555 0100" hint="Optional. Anchored rings this phone for 20 seconds before drafting a missed-call text." required={false} />
          </>
        )}
        {kind === "email-out" && <TextField name="replyTo" label="Reply-to address" type="email" placeholder="you@yourbusiness.com" hint="Customer replies come here." />}
        {kind === "stripe" && <TextField name="signingSecret" label="Signing secret" type="password" placeholder="whsec_..." hint="In Stripe, under Developers, then Webhooks, on the endpoint you add." />}
      </div>
      <div className={styles.acts}>
        <Button type="submit" disabled={busy}>
          {verb}
        </Button>
      </div>
    </form>
  );
  if (!connected) return form;
  // Once connected, the settings form is secondary, so it waits behind a disclosure.
  return (
    <details className={styles.change}>
      <summary>Change these settings</summary>
      {form}
    </details>
  );
}

/** Render one address the owner pastes into a service, read-only, with a Copy button. */
function SetupValue({ label, value }: { readonly label: string; readonly value: string }) {
  const id = useId();
  const [copied, setCopied] = useState<boolean | null>(null);
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.copyRow}>
        <input id={id} type="text" readOnly value={value} className={styles.input} onFocus={(event) => event.currentTarget.select()} />
        <Button variant="secondary" size="sm" aria-label={`Copy ${label.toLowerCase()}`} onClick={async () => setCopied(await copyText(value))}>
          Copy
        </Button>
      </div>
      <small className={styles.hint} role="status">
        {copied === null ? "" : copied ? "Copied. Now paste it." : "Your browser blocked the clipboard. Select the text to copy it."}
      </small>
    </div>
  );
}
