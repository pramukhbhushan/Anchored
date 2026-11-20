import "server-only";
import type { BusinessProfile } from "@/lib/domain/types";
import type { Store } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Adds labeled sample data to a copy of the example business: three made-up
// customers with test phone numbers and emails, finished jobs, an overdue
// invoice and two photos, so a visitor can try the customer, invoice and photo
// agents without real customer data. A business the owner built is never seeded.

/** Add the small operational dataset used by a copied example business. */
export async function seedDemoBusiness(store: Store, session: string, business: BusinessProfile, now = new Date()): Promise<void> {
  const at = now.toISOString();
  const customers = [
    { name: "Dana Ruiz", phone: "+13015550191", email: "dana@example.test" },
    { name: "Sam Lee", phone: "+13015550192", email: "sam@example.test" },
    { name: "Jordan Patel", phone: "+13015550193", email: "jordan@example.test" },
  ];
  for (const customer of customers) {
    await store.saveContact(session, {
      businessId: business.id,
      ...customer,
      consent: { source: "imported", at },
      optedOutAt: null,
    });
  }
  await Promise.all([
    store.recordEvent(session, business.id, "demo.completed-work", { customer: customers[0]?.name, completedAt: at }),
    store.recordEvent(session, business.id, "demo.completed-work", { customer: customers[1]?.name, completedAt: at }),
    store.recordEvent(session, business.id, "demo.completed-work", { customer: customers[2]?.name, completedAt: at }),
    store.recordEvent(session, business.id, "demo.overdue-invoice", { customer: customers[0]?.name, amount: 425, due: "7 days ago" }),
    store.recordEvent(session, business.id, "demo.owner-photo", { name: "finished-work-1.jpg", private: true }),
    store.recordEvent(session, business.id, "demo.owner-photo", { name: "finished-work-2.jpg", private: true }),
  ]);
}
