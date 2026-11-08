import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AgentCard } from "@/components/business/AgentCard";
import { ToastProvider } from "@/components/ui/Toast";
import type { HandOffBusiness } from "@/components/business/handoff";
import type { CardRecord, DecideCardResponse, OutboxEntry } from "@/lib/api/contract";
import { router } from "@/test/next";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// One approvals card as the owner works it: Approve sends exactly the text on
// screen, Edit lets them change it first, Skip drops it, "Rewrite in my voice"
// shows only when AI is on, a send to many people asks once more, and a locked
// allergy question offers no Approve at all. Once a text or email is approved,
// the toast opens the owner's own texting or email app with the words typed
// out. `fetch` plays the cards routes.

const CARD: CardRecord = {
  id: "card-1",
  key: "followup:closer:patel",
  businessId: "greenfield",
  status: "pending",
  edited: false,
  createdAt: "2026-11-06T13:00:00Z",
  decidedAt: null,
  agent: "followup",
  skill: "closer",
  title: "Follow up on the Patel patio quote",
  body: "Hi Priya, just checking in on the patio quote. Happy to walk through it this week.",
  reason: "Quote sent 5 days ago with no reply.",
  checks: ["Quiet hours respected", "In your voice"],
  action: "Send text",
  channel: "sms",
  to: "Priya Patel",
};

const ALLERGY: CardRecord = {
  ...CARD,
  id: "card-2",
  key: "frontdesk:catering:ana",
  agent: "frontdesk",
  skill: "catering",
  title: "Allergy question from Ana",
  body: "Ana asked whether the mole has peanuts. Call her or reply yourself.",
  reason: "An approved guess would become the restaurant's statement.",
  checks: ["Thread locked until you write the reply"],
  action: "I'll handle it",
  channel: "locked",
  to: undefined,
};

const MASS: CardRecord = { ...CARD, id: "card-3", title: "Spring cleanup reminder", action: "Send to 118 customers" };

const POST: CardRecord = {
  ...CARD,
  id: "card-4",
  key: "marketing:posts:week",
  title: "Nothing posted in 3 weeks",
  body: 'Draft post for Greenfield Landscaping: "Thanks to everyone we worked with this week."',
  action: "Copy post",
  channel: "list",
  to: undefined,
};

const SOURCE = "Follow-up agent, Closer skill";
const BUSINESS: HandOffBusiness = { name: "Greenfield Landscaping", reach: ["Phone calls", "Instagram or Facebook"], tools: [] };

/** The outbox entry the cards route writes when it approves `card`. */
function outboxFor(card: CardRecord): OutboxEntry {
  return { id: "out-1", businessId: card.businessId, cardId: card.id, channel: card.channel === "locked" || card.channel === "flag" ? "list" : card.channel, to: card.to ?? "customer", body: card.body, sentAt: "2026-11-07T15:00:00Z", delivery: "yours", note: null };
}

/** The cards route answering a decision on `card`. */
function decided(card: CardRecord, extra: Partial<DecideCardResponse> = {}): Response {
  return json({ card: { ...card, status: "approved" }, ...extra } satisfies DecideCardResponse);
}

function renderCard(card: CardRecord, canRewrite = false) {
  return render(
    <ToastProvider>
      <AgentCard card={card} source={SOURCE} canRewrite={canRewrite} business={BUSINESS} />
    </ToastProvider>,
  );
}

/** Wait for the toast that reads `text`, and return it. */
async function findToast(text: RegExp | string): Promise<HTMLElement> {
  const toast = await screen.findByText(text);
  expect(toast).toHaveRole("status");
  return toast;
}

describe("AgentCard", () => {
  it("shows the draft, who drafted it, who it goes to and why now", () => {
    renderCard(CARD);

    const card = screen.getByRole("article");
    expect(within(card).getByRole("heading", { name: CARD.title })).toBeInTheDocument();
    expect(card).toHaveTextContent(SOURCE);
    expect(card).toHaveTextContent("Priya Patel");
    expect(card).toHaveTextContent(CARD.body);
    expect(card).toHaveTextContent(CARD.reason);
    expect(card).toHaveTextContent("Quiet hours respected");
  });

  it("approves exactly the text on screen, then offers to send it from the owner's phone", async () => {
    const fetchSpy = stubFetch(() => decided(CARD, { outbox: outboxFor(CARD) }));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));

    const toast = await findToast("Approved. The text is ready to send.");
    expect(sentJson(fetchSpy, 0)).toEqual({ method: "POST", url: "/api/cards/card-1", body: { decision: "approve", body: CARD.body } });
    expect(within(toast).getByRole("link", { name: "Send from your phone" })).toHaveAttribute("href", `sms:?&body=${encodeURIComponent(CARD.body)}`);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("offers to send an approved email from the owner's own email app", async () => {
    const email: CardRecord = { ...CARD, action: "Send email", channel: "email", to: "Sam Patel", body: "Hi Sam, could we talk tomorrow?" };
    stubFetch(() => decided(email, { outbox: outboxFor(email) }));
    renderCard(email);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));

    const toast = await findToast("Approved. The email is ready to send.");
    expect(within(toast).getByRole("link", { name: "Send from your email" }).getAttribute("href")).toMatch(/^mailto:\?subject=A%20note%20from%20Greenfield%20Landscaping&body=Hi%20Sam/);
  });

  it("points to the outbox when the route logged no entry", async () => {
    stubFetch(() => decided(CARD));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));

    const toast = await findToast("Approved and logged in your outbox.");
    expect(within(toast).getByRole("link", { name: "See outbox" })).toHaveAttribute("href", "#outbox");
  });

  it("copies only a post's words, without the lead-in, when the owner approves it", async () => {
    const user = userEvent.setup();
    const fetchSpy = stubFetch(() => decided(POST, { outbox: outboxFor(POST) }));
    renderCard(POST);

    await user.click(screen.getByRole("button", { name: "Approve: Copy post" }));

    const toast = await findToast("Approved. The post is on your clipboard, ready to paste.");
    expect(await navigator.clipboard.readText()).toBe("Thanks to everyone we worked with this week.");
    expect(sentJson(fetchSpy, 0).body).toEqual({ decision: "approve", body: POST.body });
    expect(within(toast).getByRole("link", { name: "See outbox" })).toBeInTheDocument();
  });

  it("names the action on the Approve button", () => {
    renderCard(CARD);

    expect(screen.getByRole("button", { name: /^Approve/ })).toHaveTextContent("Send text");
  });

  it("lets the owner edit the draft, then approves the edited text", async () => {
    const fetchSpy = stubFetch(() => decided(CARD));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: `Edit: ${CARD.title}` }));
    const editor = screen.getByRole("textbox", { name: "Edit the draft" });
    expect(editor).toHaveValue(CARD.body);
    expect(editor).toHaveFocus();

    await userEvent.clear(editor);
    await userEvent.type(editor, "  Hi Priya, any questions on the patio quote?  ");
    await userEvent.click(screen.getByRole("button", { name: "Approve edited version" }));

    await findToast(/Approved/);
    expect(sentJson(fetchSpy, 0).body).toEqual({ decision: "approve", body: "Hi Priya, any questions on the patio quote?" });
  });

  it("approves the original text when the owner empties the editor", async () => {
    const fetchSpy = stubFetch(() => decided(CARD));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: `Edit: ${CARD.title}` }));
    await userEvent.clear(screen.getByRole("textbox", { name: "Edit the draft" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve edited version" }));

    await findToast(/Approved/);
    expect(sentJson(fetchSpy, 0).body).toEqual({ decision: "approve", body: CARD.body });
  });

  it("drops the edits on Cancel and sends nothing", async () => {
    const fetchSpy = stubFetch(() => decided(CARD));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: `Edit: ${CARD.title}` }));
    await userEvent.type(screen.getByRole("textbox", { name: "Edit the draft" }), " P.S.");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent(CARD.body);
    expect(screen.getByRole("article")).not.toHaveTextContent("P.S.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips the card", async () => {
    const fetchSpy = stubFetch(() => json({ card: { ...CARD, status: "skipped" } }));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: `Skip: ${CARD.title}` }));

    await findToast("Skipped");
    expect(sentJson(fetchSpy, 0)).toEqual({ method: "POST", url: "/api/cards/card-1", body: { decision: "skip" } });
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("holds every button while a decision is on its way", async () => {
    const answer = deferred<Response>();
    stubFetch(() => answer.promise);
    renderCard(CARD, true);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));

    for (const button of within(screen.getByRole("article")).getAllByRole("button")) expect(button).toBeDisabled();
    answer.resolve(decided(CARD));
    await findToast(/Approved/);
  });

  it("offers Rewrite in my voice only when an AI provider is set up", () => {
    const { unmount } = renderCard(CARD, true);
    expect(screen.getByRole("button", { name: "Rewrite in my voice" })).toBeInTheDocument();
    unmount();

    renderCard(CARD, false);
    expect(screen.queryByRole("button", { name: "Rewrite in my voice" })).not.toBeInTheDocument();
  });

  it("offers no rewrite for a list the owner copies", () => {
    renderCard({ ...CARD, channel: "list", action: "Copy post" }, true);

    expect(screen.queryByRole("button", { name: "Rewrite in my voice" })).not.toBeInTheDocument();
  });

  it("asks for a rewrite and refreshes the card", async () => {
    const fetchSpy = stubFetch(() => json({ card: CARD }));
    renderCard(CARD, true);

    await userEvent.click(screen.getByRole("button", { name: "Rewrite in my voice" }));

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(sentJson(fetchSpy, 0)).toEqual({ method: "POST", url: "/api/cards/card-1/rewrite", body: undefined });
  });

  it("says why a rewrite was refused, keeping the draft", async () => {
    stubFetch(() => json({ error: "The rewrite changed the price, so Anchored kept your draft." }, 422));
    renderCard(CARD, true);

    await userEvent.click(screen.getByRole("button", { name: "Rewrite in my voice" }));

    expect(await screen.findByText("The rewrite changed the price, so Anchored kept your draft.")).toBeInTheDocument();
    expect(screen.getByRole("article")).toHaveTextContent(CARD.body);
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("offers no Approve, Edit, Skip or rewrite on a locked allergy question, only I'll handle it", () => {
    renderCard(ALLERGY, true);

    const card = screen.getByRole("article");
    expect(within(card).getAllByRole("button").map((button) => button.textContent)).toEqual(["I'll handle it"]);
  });

  it("marks a locked question as the owner's, with no outbox link", async () => {
    const fetchSpy = stubFetch(() => decided(ALLERGY));
    renderCard(ALLERGY);

    await userEvent.click(screen.getByRole("button", { name: "I'll handle it" }));

    const toast = await findToast("Marked as yours");
    expect(within(toast).queryByRole("link")).not.toBeInTheDocument();
    expect(sentJson(fetchSpy, 0).body).toEqual({ decision: "approve", body: ALLERGY.body });
  });

  it("asks once more before a send to many people, and sends nothing on Cancel", async () => {
    const fetchSpy = stubFetch(() => decided(MASS));
    renderCard(MASS);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));
    const confirm = screen.getByRole("group", { name: "Confirm send" });
    expect(confirm).toHaveTextContent("118 customers");
    expect(fetchSpy).not.toHaveBeenCalled();

    await userEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("group", { name: "Confirm send" })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends to many people once the owner confirms", async () => {
    const fetchSpy = stubFetch(() => decided(MASS, { outbox: outboxFor(MASS) }));
    renderCard(MASS);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, approve for 118 customers" }));

    // A group text goes through a texting service with consent records, never the owner's own phone.
    const toast = await findToast("Approved. Copy the text from your outbox.");
    expect(within(toast).getByRole("link", { name: "See outbox" })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(sentJson(fetchSpy, 0).body).toEqual({ decision: "approve", body: MASS.body });
  });

  it("shows the rule that stopped a send on the card", async () => {
    stubFetch(() => json({ card: CARD, blocked: "Quiet hours: texts wait until 8am." } satisfies DecideCardResponse));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));

    expect(await screen.findByText(/Quiet hours: texts wait until 8am\./)).toHaveTextContent(/Not sent/);
  });

  it("offers a reload when the draft changed since the owner saw it", async () => {
    stubFetch(() => json({ error: "Card changed" }, 409));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Reload" }));

    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("says why an approval failed", async () => {
    stubFetch(() => json({ error: "That business no longer exists." }, 404));
    renderCard(CARD);

    await userEvent.click(screen.getByRole("button", { name: /^Approve/ }));

    expect(await screen.findByText("That business no longer exists.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reload" })).not.toBeInTheDocument();
  });

  it("shows a decided card's outcome with nothing left to press", () => {
    renderCard({ ...CARD, status: "approved", edited: true, decidedAt: "2026-11-06T15:00:00Z" });

    const card = screen.getByRole("article");
    expect(card).toHaveTextContent(/Approved/);
    expect(card).toHaveTextContent(/edit/i);
    expect(within(card).queryAllByRole("button")).toEqual([]);
  });
});
