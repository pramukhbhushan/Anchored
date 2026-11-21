"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { agentHref, businessHref, cardAnchor } from "@/components/routes";
import { OWNER_TIME_ZONE } from "@/lib/domain/executor";
import styles from "./customer-threads.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The customer conversations on the Customer agent page, read-only. The page
// loads the threads; the picked customer lives in the URL as `?contact=`, and a
// message an agent drafted links to its card in Approvals. Nothing here sends a
// reply or changes consent.

/** One customer in the list, with their latest message. */
export interface ThreadContact {
  readonly id: string;
  readonly name: string;
  readonly lastText?: string;
  readonly lastAt?: string;
  readonly stopped: boolean;
  readonly locked: boolean;
}

/** One stored message, in the order the page supplies. */
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

/** The customers, the picked customer's messages, and why they can't load, if they can't. */
export interface CustomerThreadsData {
  readonly contacts: readonly ThreadContact[];
  readonly selectedContactId: string | null;
  readonly messages: readonly ThreadMessage[];
  readonly unavailableReason?: string;
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

/** Render a message time, or say it is unavailable when the stored time doesn't parse. */
function MessageTime({ at }: { readonly at: string }) {
  const date = new Date(at);
  return Number.isNaN(date.getTime())
    ? <span>Time unavailable</span>
    : <time dateTime={at}>{DATE.format(date)}</time>;
}

/** Render the customer list and the picked customer's conversation. */
export function CustomerThreads({ businessId, data }: { readonly businessId: string; readonly data: CustomerThreadsData }) {
  const search = useSearchParams();
  const selected = data.contacts.find((contact) => contact.id === data.selectedContactId);

  function contactHref(id: string): string {
    const params = new URLSearchParams(search.toString());
    params.set("contact", id);
    return `${agentHref(businessId, "customer")}?${params.toString()}`;
  }

  return (
    <section className={styles.section} aria-label="Customer conversations">
      <div className={styles.heading}>
        <h2>Customer conversations</h2>
      </div>
      {data.unavailableReason !== undefined ? (
        <p className={styles.state} role="status">{data.unavailableReason}</p>
      ) : data.contacts.length === 0 ? (
        <p className={styles.state} role="status">No customer conversations yet.</p>
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
                {data.messages.length === 0 ? (
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
