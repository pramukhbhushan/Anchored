"use client";

import { ChevronDown, LogOut, Mail, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { callApi, errorText } from "@/components/api";
import { APP_HREF } from "@/components/routes";
import { useToast } from "@/components/ui/Toast";
import type { DeleteBusinessesResponse } from "@/lib/api/contract";
import { createBrowserSupabase } from "@/lib/auth/browser";
import { authErrorText } from "@/lib/auth/errors";
import { callbackUrl, SIGN_OUT_PATH } from "@/lib/auth/paths";
import type { Viewer } from "@/lib/auth/viewer";
import styles from "./AccountMenu.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The account control in the app's top bar and the site header. `AccountMenu`
// shows who is signed in and opens a panel with "Save your work" for guests,
// "Delete my businesses" and "Sign out". The panel is a disclosure, not an ARIA
// menu, because it holds forms; Escape, a click outside, or tabbing away closes
// it. With accounts off it names the browser and has no sign-out.

/** The guest's "Save your work" flow: hidden, typing an email, sending, or sent. */
type SaveState =
  | { readonly step: "closed" }
  | { readonly step: "editing"; readonly error: string | null }
  | { readonly step: "sending" }
  | { readonly step: "sent"; readonly email: string }
  | { readonly step: "saved"; readonly email: string };

/** Props for `AccountMenu`. */
export interface AccountMenuProps {
  readonly viewer: Viewer;
}

/** Return the name the trigger shows: the browser with accounts off, "Guest", or the account's email. */
function displayName(viewer: Viewer): string {
  if (!viewer.authEnabled) return "This browser";
  return viewer.isGuest ? "Guest" : (viewer.email ?? "Your account");
}

// =============================================================================
// The disclosure
// =============================================================================

/** Render the trigger and its panel, and close the panel when focus or a click goes elsewhere. */
export function AccountMenu({ viewer }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const name = displayName(viewer);
  // With accounts off nobody signs in, so there is no guest to save and no session to end.
  const canSaveWork = viewer.authEnabled && viewer.isGuest;

  // Pointer for clicks outside, focusin for tabbing out. Blur alone misfires in Safari, where clicking a button doesn't focus it.
  useEffect(() => {
    if (!open) return;
    const closeIfOutside = (event: Event) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside);
    document.addEventListener("focusin", closeIfOutside);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside);
      document.removeEventListener("focusin", closeIfOutside);
    };
  }, [open]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div ref={rootRef} className={styles.root} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span className={viewer.isGuest ? `${styles.avatar} ${styles.guestAvatar}` : styles.avatar} aria-hidden="true">
          {viewer.isGuest || !viewer.email ? <UserRound /> : viewer.email.charAt(0).toUpperCase()}
        </span>
        <span className={styles.name}>{name}</span>
        <span className="sr">account menu</span>
        <ChevronDown className={styles.chevron} aria-hidden="true" />
      </button>

      <div id={panelId} className={styles.panel} hidden={!open}>
        {!viewer.authEnabled ? (
          <div className={styles.who}>
            <b>This browser</b>
            <p>Accounts are off on this server, so your work is tied to this browser.</p>
          </div>
        ) : viewer.isGuest ? (
          <div className={styles.who}>
            <b>Guest</b>
            <p>Your work is tied to this browser. Signing out or clearing cookies loses it unless you add an email.</p>
          </div>
        ) : (
          <div className={styles.who}>
            <span className={styles.caption}>Signed in as</span>
            <b>{viewer.email}</b>
          </div>
        )}
        {canSaveWork && <SaveWork />}
        <DeleteBusinesses />
        {viewer.authEnabled && (
          <form className={styles.signOut} method="post" action={SIGN_OUT_PATH}>
            <button type="submit" className={styles.item}>
              <LogOut aria-hidden="true" />
              Sign out
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Panel sections
// =============================================================================

/** Render "Delete my businesses": a confirmation that names what goes, then the delete and a return to the list. */
function DeleteBusinesses() {
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await callApi<DeleteBusinessesResponse>("/api/businesses", "DELETE");
      toast("Your businesses are deleted");
      setConfirming(false);
      // `refresh` re-renders the shell so its business list and counts drop what was deleted.
      router.push(APP_HREF);
      router.refresh();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <div className={styles.section}>
        <button type="button" className={styles.item} onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" />
          Delete my businesses
        </button>
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <div className={styles.confirm} role="group" aria-label="Confirm deleting your businesses">
        <p>
          This deletes your businesses, every path you chose, and all approvals and outbox messages, including what you
          changed on the example. It can&apos;t be undone.
        </p>
        <div className={styles.actions}>
          <button ref={confirmRef} type="button" className="btn sm" onClick={remove} disabled={busy}>
            {busy ? "Deleting..." : "Delete everything"}
          </button>
          <button type="button" className="btn sm ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </button>
        </div>
        {error !== null && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** Render "Save your work": an inline email field that turns a guest into an account with the same data. */
function SaveWork() {
  const [state, setState] = useState<SaveState>({ step: "closed" });
  const [email, setEmail] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef<HTMLParagraphElement>(null);
  const emailId = useId();

  // Move focus with the content: into the field when it opens or a send fails, onto the confirmation once sent.
  useEffect(() => {
    if (state.step === "editing") emailRef.current?.focus();
    if (state.step === "sent" || state.step === "saved") sentRef.current?.focus();
  }, [state.step]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    setState({ step: "sending" });
    try {
      // Adding an email keeps the guest's user id, so everything stored under it carries over once they confirm.
      const here = `${window.location.pathname}${window.location.search}`;
      const { data, error } = await createBrowserSupabase().auth.updateUser(
        { email: address },
        { emailRedirectTo: callbackUrl(window.location.origin, here) },
      );
      // A project that doesn't confirm email changes applies the address at once and sends nothing,
      // so only a pending `new_email` means a link is on its way.
      const appliedNow = data.user?.email === address && !data.user?.new_email;
      setState(error ? { step: "editing", error: authErrorText(error) } : appliedNow ? { step: "saved", email: address } : { step: "sent", email: address });
    } catch (error) {
      // `createBrowserSupabase` throws when the public keys were missing at build time, and `fetch` throws offline.
      setState({ step: "editing", error: authErrorText(error) });
    }
  }

  if (state.step === "closed") {
    return (
      <div className={styles.section}>
        <button type="button" className={styles.item} onClick={() => setState({ step: "editing", error: null })}>
          <Mail aria-hidden="true" />
          Save your work
        </button>
      </div>
    );
  }

  if (state.step === "saved") {
    return (
      <div className={styles.section}>
        <p ref={sentRef} tabIndex={-1} className={styles.sent} role="status">
          Saved. Your work is now kept under <b>{state.email}</b>.
        </p>
      </div>
    );
  }

  if (state.step === "sent") {
    return (
      <div className={styles.section}>
        <p ref={sentRef} tabIndex={-1} className={styles.sent} role="status">
          Check your email. Open the link we sent to <b>{state.email}</b> to save this work to your account.
        </p>
      </div>
    );
  }

  const sending = state.step === "sending";
  return (
    <div className={styles.section}>
      <form className={styles.saveForm} onSubmit={save} aria-busy={sending}>
        <label htmlFor={emailId}>Email to save your work to</label>
        <input
          id={emailId}
          ref={emailRef}
          className={styles.input}
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@yourbusiness.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          // Read-only rather than disabled, so focus stays in the field while the link sends
          readOnly={sending}
        />
        <div className={styles.actions}>
          <button type="submit" className="btn sm" disabled={sending}>
            {sending ? "Sending..." : "Send link"}
          </button>
          <button type="button" className="btn sm ghost" onClick={() => setState({ step: "closed" })} disabled={sending}>
            Cancel
          </button>
        </div>
        {state.step === "editing" && state.error && (
          <p role="alert" className={styles.error}>
            {state.error}
          </p>
        )}
      </form>
    </div>
  );
}
