import { answerConnections, removeContact } from "@/lib/server/connections";

// =============================================================================
// Module Overview
// =============================================================================
// DELETE /api/businesses/[id]/contacts/[contactId] removes one customer from the
// business's list and answers with the Connections page's data.

/** Remove one customer. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; contactId: string }> }) {
  const { id, contactId } = await params;
  return answerConnections({
    request,
    businessId: id,
    route: "DELETE /api/businesses/[id]/contacts/[contactId]",
    change: (session, business) => removeContact(session, business.id, contactId),
  });
}
