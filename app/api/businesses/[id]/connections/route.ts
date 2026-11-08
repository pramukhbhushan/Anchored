import { connectSchema } from "@/lib/api/schemas";
import { CONNECTION_KINDS, type ConnectionKind } from "@/lib/domain/connections";
import { answerConnections, connect, disconnect } from "@/lib/server/connections";
import { fail, readBody } from "@/lib/server/http";

// =============================================================================
// Module Overview
// =============================================================================
// /api/businesses/[id]/connections: GET reads the Connections page's data, PUT
// connects one service and DELETE `?kind=` disconnects one. Each answers with
// the page's data. Only an account on the owner's own business may change a
// connection; `answerConnections` refuses the example and guests.

type Params = { params: Promise<{ id: string }> };

/** Narrow the `?kind=` value to a `ConnectionKind`. */
function isConnectionKind(value: string | null): value is ConnectionKind {
  return CONNECTION_KINDS.some((kind) => kind === value);
}

/** Return whether the visitor may connect, every service and every contact. */
export async function GET(request: Request, { params }: Params) {
  const { id } = await params;
  return answerConnections({ request, businessId: id, route: "GET /api/businesses/[id]/connections" });
}

/** Connect one service, replacing any earlier connection of the same kind. */
export async function PUT(request: Request, { params }: Params) {
  const parsed = await readBody(request, connectSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = await params;
  return answerConnections({
    request,
    businessId: id,
    route: "PUT /api/businesses/[id]/connections",
    change: (session, business) => connect(session, business, parsed.data),
  });
}

/** Disconnect the service named by `?kind=`. */
export async function DELETE(request: Request, { params }: Params) {
  const kind = new URL(request.url).searchParams.get("kind");
  if (!isConnectionKind(kind)) return fail(400, `\`kind\` must be ${CONNECTION_KINDS.join(", ")}.`);
  const { id } = await params;
  return answerConnections({
    request,
    businessId: id,
    route: "DELETE /api/businesses/[id]/connections",
    change: (session, business) => disconnect(session, business.id, kind),
  });
}
