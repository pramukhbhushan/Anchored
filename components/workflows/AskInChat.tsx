"use client";

import { MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import styles from "./automations.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The chat box on every automation page: a question or a note for Anchored
// about this automation, and a button that carries it to the business chat,
// where it waits in the text box so the owner can add photos and send it.

/** Chat about one automation: `prompt` labels the box, and the words go to `chatHref` in its text box. */
export function AskInChat({ chatHref, prompt, placeholder }: { readonly chatHref: string; readonly prompt: string; readonly placeholder: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const id = useId();

  function submit(event: FormEvent): void {
    event.preventDefault();
    const words = text.trim();
    router.push(words === "" ? chatHref : `${chatHref}?ask=${encodeURIComponent(words)}`);
  }

  return (
    <form className={styles.ask} onSubmit={submit}>
      <label htmlFor={id} className={styles.askLabel}>{prompt}</label>
      <textarea id={id} className={styles.askBox} rows={3} maxLength={2000} placeholder={placeholder} value={text} onChange={(event) => setText(event.target.value)} />
      <button type="submit" className="btn">
        <MessageSquare aria-hidden="true" size={16} /> Continue in Chat
      </button>
    </form>
  );
}
