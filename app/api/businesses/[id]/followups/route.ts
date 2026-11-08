import { randomUUID } from "node:crypto";
import { cancelFollowupSchema, scheduleFollowupSchema } from "@/lib/api/schemas";
import { chosenSkills, resolveChoices } from "@/lib/domain/paths";
import { runBusinessAgentWork } from "@/lib/server/agent-work";
import { findBusiness } from "@/lib/server/data";
import { fail, handleError, json, readBody } from "@/lib/server/http";
import { getSessionId } from "@/lib/server/session";
import { getStore } from "@/lib/store";

// =============================================================================
// Module Overview
// =============================================================================
// Session-scoped owner records for Customer timers. A due timer creates a card
// for approval only. Cancellation keeps its facts and invalidates old drafts.
// Incoming requests never supply business or session ownership.

type Params = { params: Promise<{ id: string }> };

/** Read this business's recorded timers. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    return json({ records: await getStore().listFollowups(await getSessionId(), business.id) });
  } catch (error) { return handleError(error, "GET /api/businesses/[id]/followups"); }
}

/** Record explicit facts and a due time, then check whether an approval draft is due. */
export async function POST(request: Request, { params }: Params) {
  try {
    const body = await readBody(request, scheduleFollowupSchema);
    if (!body.ok) return body.response;
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    const session = await getSessionId();
    const store = getStore();
    const records = await store.listFollowups(session, business.id);
    if (records.length >= 200) return fail(409, "This business already has 200 recorded follow-ups.");
    const contacts = await store.listContacts(session, business.id);
    const contact = contacts.find((candidate) => candidate.id === body.data.contactId);
    if (contact === undefined) return fail(404, "Customer not found in this business.");
    if (body.data.skill !== "debrief" && (contact.telegramChatId === undefined || contact.consent === null || contact.optedOutAt !== null)) return fail(409, "This customer must start your Telegram chat before you can record a follow-up message.");
    const chosen = chosenSkills(business, resolveChoices(business, await store.getChoices(session, business.id)));
    if (!chosen.includes(body.data.skill)) return fail(409, "Choose this job on Workflows before recording its follow-up.");
    await store.saveFollowup(session, { ...body.data, dueAt: new Date(body.data.dueAt).toISOString(), id: randomUUID(), businessId: business.id, status: "active" });
    await runBusinessAgentWork(store, session, business);
    return json({ records: await store.listFollowups(session, business.id) });
  } catch (error) { return handleError(error, "POST /api/businesses/[id]/followups"); }
}

/** Cancel only an existing timer owned by this business. */
export async function PUT(request: Request, { params }: Params) {
  try {
    const body = await readBody(request, cancelFollowupSchema);
    if (!body.ok) return body.response;
    const business = await findBusiness((await params).id);
    if (business === null || business.kind !== "custom") return fail(404, "Business not found.");
    const session = await getSessionId();
    const store = getStore();
    const record = (await store.listFollowups(session, business.id)).find((item) => item.id === body.data.id);
    if (record === undefined) return fail(404, "Follow-up not found in this business.");
    await store.saveFollowup(session, { ...record, status: "cancelled" });
    await runBusinessAgentWork(store, session, business);
    return json({ records: await store.listFollowups(session, business.id) });
  } catch (error) { return handleError(error, "PUT /api/businesses/[id]/followups"); }
}
