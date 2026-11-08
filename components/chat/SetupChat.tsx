import type { ChatMessage } from "@/lib/api/contract";
import styles from "./setup-chat.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The onboarding conversation that set up this business, kept above its chat
// as a closed `<details>` the owner can open to read it again. Read-only: the
// answers there already built the plan, and changes go in the chat below.

const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

/** Render the business's setup chat, or nothing when it has none. */
export function SetupChat({ messages }: { readonly messages: readonly ChatMessage[] }) {
  if (messages.length === 0) return null;
  const first = messages[0];
  return (
    <details className={styles.setup}>
      <summary>
        Your setup chat{first ? `, ${DAY.format(new Date(first.at))}` : ""} <span className="muted">({messages.length} messages)</span>
      </summary>
      <ol className={styles.messages} aria-label="Your setup chat">
        {messages.map((message) => (
          <li key={message.id} data-role={message.role}>
            <b>{message.role === "owner" ? "You" : "Anchored"}</b>
            <p>{message.text}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}
