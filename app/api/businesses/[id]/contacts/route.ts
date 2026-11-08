import { saveContactSchema } from "@/lib/api/schemas";
import { answerConnections, saveOwnerContact } from "@/lib/server/connections";
import { readBody } from "@/lib/server/http";

// =============================================================================
// Module Overview
// =============================================================================
// POST /api/businesses/[id]/contacts adds a customer, or updates one by `id`,
// and answers with the Connections page's data. `saveOwnerContact` checks the
// phone and email and dates the customer's texting OK.

/** Add or update one customer. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = await readBody(request, saveContactSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  return answerConnections({
    request,
    businessId: id,
    route: "POST /api/businesses/[id]/contacts",
    change: async (session, business) => {
      await saveOwnerContact(session, business.id, parsed.data);
    },
  });
}
