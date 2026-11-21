import type { Metadata } from "next";
import { headers } from "next/headers";
import { TelegramQr } from "@/components/connections/TelegramQr";
import { TelegramSetup } from "@/components/connections/TelegramSetup";
import { ConnectionsPanel } from "@/components/connections/ConnectionsPanel";
import { ContactsList } from "@/components/connections/ContactsList";
import styles from "@/components/connections/connections.module.css";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { appBaseUrl, connectionsResponse } from "@/lib/server/connections";
import { getBusinessOrNotFound } from "@/lib/server/data";
import { findViewer, getSessionId } from "@/lib/server/session";
import { telegramSetup } from "@/lib/server/telegram-setup";

// =============================================================================
// Module Overview
// =============================================================================
// Connections: the owner's own AI key, which Anchored writes drafts with; the
// outside services that let Anchored send what the owner approves and turn
// customer texts, calls, emails and unpaid invoices into drafts; then the
// customers Anchored may contact. A guest, or a visitor to the example
// business, reads what each one does but can't connect it.

export const metadata: Metadata = { title: "Connections" };

/** Render the AI key, the services and the customer list for the business in the URL. */
export default async function ConnectionsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [session, viewer, requestHeaders] = await Promise.all([getSessionId(), findViewer(), headers()]);
  const [data, telegram] = await Promise.all([connectionsResponse(session, business, viewer, appBaseUrl(requestHeaders)), telegramSetup(session, business)]);
  const isSample = business.kind === "case";

  return (
    <>
      <PageHeader title="Connections" description="Add your own AI key, and connect your texting number, email and Stripe. Anchored sends only what you approve." />
      <section className="section panel">
        <TelegramSetup businessId={business.id} url={telegram.url} unavailableReason={telegram.unavailableReason ?? undefined} qrCode={telegram.url === null ? undefined : <TelegramQr url={telegram.url} />} />
      </section>
      <section className="section" aria-labelledby="services">
        <SectionHeader id="services" title="AI and services" />
        <ConnectionsPanel
          businessId={business.id}
          blocked={data.blocked}
          ai={data.ai}
          blockedLink={isSample ? { href: NEW_BUSINESS_HREF, label: "Set up your business" } : undefined}
          connections={data.connections}
        />
      </section>
      <section className={`section ${styles.customers}`} aria-labelledby="customers">
        <SectionHeader id="customers" title="Customers" />
        <ContactsList businessId={business.id} canChange={data.blocked === null} contacts={data.contacts} />
      </section>
    </>
  );
}
