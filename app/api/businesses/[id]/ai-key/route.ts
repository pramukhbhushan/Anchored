import { saveAiKeySchema } from "@/lib/api/schemas";
import { answerConnections, disconnect, saveAiKey } from "@/lib/server/connections";
import { readBody } from "@/lib/server/http";

// =============================================================================
// Module Overview
// =============================================================================
// /api/businesses/[id]/ai-key: PUT checks the owner's own AI key with one short
// call to its provider, then saves it encrypted; DELETE removes it, and the
// business goes back to the rules. Each answers with the
// Connections page's data, which shows the key's last four characters only.
// It has its own route so `middleware.ts` can rate-limit the check, which
// calls a model. `answerConnections` refuses the example and guests.

type Params = { params: Promise<{ id: string }> };

/** Check and save the owner's AI key, replacing any earlier one. */
export async function PUT(request: Request, { params }: Params) {
  const parsed = await readBody(request, saveAiKeySchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  return answerConnections({
    request,
    businessId: id,
    route: "PUT /api/businesses/[id]/ai-key",
    change: (session, business) => saveAiKey(session, business, parsed.data),
  });
}

/** Remove the owner's AI key. */
export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  return answerConnections({
    request,
    businessId: id,
    route: "DELETE /api/businesses/[id]/ai-key",
    change: (session, business) => disconnect(session, business.id, "ai"),
  });
}
