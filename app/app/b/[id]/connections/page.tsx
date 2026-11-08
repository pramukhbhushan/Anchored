import type { Metadata } from "next";
import { headers } from "next/headers";
import { TelegramSetup } from "@/components/connections/TelegramSetup";
import { ConnectionsPanel } from "@/components/connections/ConnectionsPanel";
import { ContactsList } from "@/components/connections/ContactsList";
import { NEW_BUSINESS_HREF } from "@/components/routes";
import { PageHeader, SectionHeader } from "@/components/ui/PageHeader";
import { appBaseUrl, connectionsResponse } from "@/lib/server/connections";
import { getBusinessOrNotFound } from "@/lib/server/data";
import { findViewer, getSessionId } from "@/lib/server/session";

// =============================================================================
// Module Overview
// =============================================================================
// Connections: the outside services that let Anchored send what the owner
// approves and turn customer texts, calls, emails and unpaid invoices into
// drafts, then the customers Anchored may contact. A guest, or a visitor to
// the example business, reads what each service does but can't connect one.

export const metadata: Metadata = { title: "Connections" };

/** Render the services and the customer list for the business in the URL. */
export default async function ConnectionsPage({ params }: { readonly params: Promise<{ id: string }> }) {
  const { id } = await params;
  const business = await getBusinessOrNotFound(id);
  const [session, viewer, requestHeaders] = await Promise.all([getSessionId(), findViewer(), headers()]);
  const data = await connectionsResponse(session, business, viewer, appBaseUrl(requestHeaders));
  const isSample = business.kind === "case";

  return (
    <>
      <PageHeader title="Connections" description="Connect your own texting number, email and Stripe. Anchored sends only what you approve." />
      <section className="section">
        <TelegramSetup businessId={business.id} url={null} unavailableReason={isSample ? "Set up your own business to try Telegram when it is available." : "Telegram isn't available for this business yet. Existing email and invoice connections are listed below."} />
      </section>
      <section className="section" aria-labelledby="services">
        <SectionHeader id="services" title="Services" />
        <ConnectionsPanel
          businessId={business.id}
          blocked={data.blocked}
          blockedLink={isSample ? { href: NEW_BUSINESS_HREF, label: "Set up your business" } : undefined}
          connections={data.connections}
        />
      </section>
      <section className="section" aria-labelledby="customers">
        <SectionHeader id="customers" title="Customers" />
        <ContactsList businessId={business.id} canChange={data.blocked === null} contacts={data.contacts} />
      </section>
    </>
  );
}
