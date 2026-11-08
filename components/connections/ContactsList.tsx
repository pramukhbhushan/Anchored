"use client";

import { useId, useState, type FormEvent } from "react";
import { callApi, errorText } from "@/components/api";
import { Button } from "@/components/ui/Button";
import type { ConnectionsResponse, SaveContactRequest } from "@/lib/api/contract";
import { CONSENT_LABEL, CONSENT_SOURCES, type ConsentSource, type Contact } from "@/lib/domain/contacts";
import styles from "./connections.module.css";

// =============================================================================
// Module Overview
// =============================================================================
// The business's customers on the Connections page: each one's phone, email
// and where their OK to get texts came from, or that they texted STOP. The
// owner adds a customer with the form below the list and removes one with its
// Remove button. Anchored texts only a customer with an OK on file.

/** Props for `ContactsList`. */
export interface ContactsListProps {
  readonly businessId: string;
  /** False when the visitor can't change the list, such as a guest or a visitor to the example. */
  readonly canChange: boolean;
  readonly contacts: readonly Contact[];
}

/** Return the contacts route for `businessId`. */
function contactsUrl(businessId: string): string {
  return `/api/businesses/${encodeURIComponent(businessId)}/contacts`;
}

/** Say where a customer's texting OK came from, or that there is none. */
function consentText(contact: Contact): string {
  return contact.consent === null ? "No texting OK on file" : CONSENT_LABEL[contact.consent.source];
}

/** Narrow the consent select's value to a `ConsentSource`, or `null` for "None yet". */
function consentFrom(value: FormDataEntryValue | null): ConsentSource | null {
  return CONSENT_SOURCES.find((source) => source === value) ?? null;
}

/** Render the customer list, with an add form and a Remove button on each customer. */
export function ContactsList({ businessId, canChange, contacts }: ContactsListProps) {
  const [list, setList] = useState(contacts);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), phone: useId(), email: useId(), consent: useId() };

  /** Send one change and show the list the route answers with, or its error. */
  async function change(send: () => Promise<ConnectionsResponse>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      setList((await send()).contacts);
      return true;
    } catch (failure) {
      setError(errorText(failure));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? "").trim();
    const body: SaveContactRequest = {
      name: text("name"),
      ...(text("phone") === "" ? {} : { phone: text("phone") }),
      ...(text("email") === "" ? {} : { email: text("email") }),
      consent: consentFrom(data.get("consent")),
    };
    if (await change(() => callApi<ConnectionsResponse>(contactsUrl(businessId), "POST", body))) form.reset();
  }

  function onRemove(contact: Contact) {
    void change(() => callApi<ConnectionsResponse>(`${contactsUrl(businessId)}/${encodeURIComponent(contact.id)}`, "DELETE"));
  }

  return (
    <div className={styles.stack}>
      <p className={styles.lead}>Anchored texts only customers with an OK on file. Anyone who texts STOP is never texted again.</p>
      {list.length === 0 ? (
        <p className={styles.empty}>No customers yet.{canChange ? " Add one below." : ""}</p>
      ) : (
        <table className="rtable">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Phone</th>
              <th scope="col">Email</th>
              <th scope="col">Texting OK</th>
              {canChange && (
                <th scope="col">
                  <span className={styles.srOnly}>Remove</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {list.map((contact) => (
              <tr key={contact.id}>
                <th scope="row">{contact.name}</th>
                <td data-label="Phone">{contact.phone ?? "None"}</td>
                <td data-label="Email">{contact.email ?? "None"}</td>
                <td data-label="Texting OK">
                  {consentText(contact)}
                  {contact.optedOutAt !== null && <span className={styles.stopped}>Texted STOP</span>}
                </td>
                {canChange && (
                  <td data-label="">
                    <Button variant="quiet" size="sm" aria-label={`Remove ${contact.name}`} disabled={busy} onClick={() => onRemove(contact)}>
                      Remove
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {canChange && (
        <form className={styles.form} onSubmit={onAdd} aria-label="Add a customer">
          <div className={styles.contactFields}>
            <div className={styles.field}>
              <label htmlFor={ids.name}>Name</label>
              <input id={ids.name} name="name" type="text" required autoComplete="off" className={styles.input} />
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.phone}>Phone</label>
              <input id={ids.phone} name="phone" type="tel" placeholder="(301) 555-0192" autoComplete="off" className={styles.input} />
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.email}>Email</label>
              <input id={ids.email} name="email" type="email" placeholder="dana@example.com" autoComplete="off" className={styles.input} />
            </div>
            <div className={styles.field}>
              <label htmlFor={ids.consent}>Texting OK</label>
              <select id={ids.consent} name="consent" defaultValue="" className={styles.input}>
                <option value="">None yet</option>
                {CONSENT_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {CONSENT_LABEL[source]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.acts}>
            <Button type="submit" disabled={busy}>
              Add customer
            </Button>
          </div>
        </form>
      )}
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
