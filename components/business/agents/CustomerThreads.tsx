"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { agentHref, businessHref, cardAnchor } from "@/components/routes";
import { Button } from "@/components/ui/Button";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";
import styles from "./customer-threads.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// Read-only customer conversations inside the Customer agent workspace. The
// caller supplies session-scoped data; selection stays in the URL and drafts
// link to the existing Approvals queue. This view neither fetches messages nor
// sends replies, changes consent, or substitutes examples for unavailable data.

/** A customer summary supplied by the conversation read interface. */
export interface ThreadContact {
  readonly id: string;
  readonly name: string;
  readonly lastText?: string;
  readonly lastAt?: string;
  readonly stopped: boolean;
  readonly locked: boolean;
}

/** A stored message, already ordered by the conversation read interface. */
export interface ThreadMessage {
  readonly id: string;
  readonly direction: "in" | "out";
  readonly text: string;
  readonly at: string;
  readonly skill?: string;
  readonly cardKey?: string;
  readonly delivery?: "queued" | "sending" | "sent" | "failed";
  readonly note?: string;
}

/** Display-only conversation data, to be replaced by agreed API types at integration. */
export interface CustomerThreadsData {
  readonly contacts: readonly ThreadContact[];
  readonly selectedContactId: string | null;
  readonly messages: readonly ThreadMessage[];
  readonly unavailableReason?: string;
}

/** Props for the customer conversation view, with an optional caller-owned refresh. */
export interface CustomerThreadsProps {
  readonly businessId: string;
  readonly data: CustomerThreadsData;
  readonly pending?: boolean;
  readonly onRefresh?: () => void;
}

const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: OWNER_TIME_ZONE,
});

const DELIVERY: Readonly<Record<NonNullable<ThreadMessage["delivery"]>, string>> = {
  queued: "Waiting to send",
  sending: "Sending now",
  sent: "Sent",
  failed: "Didn't send",
};

function MessageTime({ at }: { readonly at: string }) {
  const date = new Date(at);
  return Number.isNaN(date.getTime())
    ? <span>Time unavailable</span>
    : <time dateTime={at}>{DATE.format(date)}</time>;
}

/** Render customer selection and its read-only conversation without a direct-send action. */
export function CustomerThreads({ businessId, data, pending = false, onRefresh }: CustomerThreadsProps) {
  const search = useSearchParams();
  const selected = data.contacts.find((contact) => contact.id === data.selectedContactId);

  function contactHref(id: string): string {
    const params = new URLSearchParams(search.toString());
    params.set("contact", id);
    return `${agentHref(businessId, "customer")}?${params.toString()}`;
  }

  return (
    <section className={styles.section} aria-label="Customer conversations" aria-busy={pending}>
      <div className={styles.heading}>
        <h2>Customer conversations</h2>
        {onRefresh !== undefined && (
          <Button variant="quiet" size="sm" disabled={pending} onClick={onRefresh}>
            {pending ? "Refreshing conversations..." : "Refresh conversations"}
          </Button>
        )}
      </div>
      {data.unavailableReason !== undefined ? (
        <p className={styles.state} role="status">{data.unavailableReason}</p>
      ) : data.contacts.length === 0 ? (
        <p className={styles.state} role="status">{pending ? "Loading customer conversations..." : "No customer conversations yet."}</p>
      ) : (
        <div className={styles.layout}>
          <nav aria-label="Customers" className={styles.customers}>
            <ul className={styles.customerList}>
              {data.contacts.map((contact) => (
                <li key={contact.id}>
                  <Link href={contactHref(contact.id)} aria-current={contact.id === selected?.id ? "true" : undefined} className={styles.customer}>
                    <span className={styles.name}>{contact.name}</span>
                    {contact.lastText !== undefined && <span className={styles.preview}>{contact.lastText}</span>}
                    {contact.lastAt !== undefined && <small><MessageTime at={contact.lastAt} /></small>}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.conversation}>
            {selected === undefined ? (
              <p className={styles.state} role="status">
                {data.selectedContactId === null
                  ? "Choose a customer to read their messages."
                  : "This customer is no longer in the list. Choose another customer."}
              </p>
            ) : (
              <section aria-label={`Conversation with ${selected.name}`} className={styles.thread}>
                <h3 className={styles.name}>{selected.name}</h3>
                {selected.stopped && <p className={styles.warning}>Messages stopped. Anchored won't message this customer.</p>}
                {selected.locked && <p className={styles.warning}>Allergy question. This conversation is locked for you to handle.</p>}
                {pending ? (
                  <p className={styles.state} role="status">Loading messages...</p>
                ) : data.messages.length === 0 ? (
                  <p className={styles.state} role="status">No messages in this conversation yet.</p>
                ) : (
                  <ol className={styles.messages} aria-label={`Messages with ${selected.name}`}>
                    {data.messages.map((message) => (
                      <li key={message.id} className={styles.message} data-direction={message.direction}>
                        <div className={styles.messageHead}>
                          <strong>{message.direction === "in" ? "From customer" : "From business"}</strong>
                          <small><MessageTime at={message.at} /></small>
                        </div>
                        <p className={styles.messageText}>{message.text}</p>
                        {message.delivery !== undefined && <p className={styles.delivery}>{DELIVERY[message.delivery]}</p>}
                        {message.note !== undefined && <p className={styles.note}>{message.note}</p>}
                        {message.skill !== undefined && <small className={styles.note}>Handled by {message.skill}</small>}
                        {message.cardKey !== undefined && (
                          <Link href={`${businessHref(businessId, "approvals")}#${cardAnchor(message.cardKey)}`}>See card in Approvals</Link>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
