import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { BusinessChatResponse, ChatMessage, IntakeResponse, StartIntakeResponse } from "@/lib/api/contract";
import type { IntakeOption, IntakeQuestion } from "@/lib/domain/intake";
import { router } from "@/test/next";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// The business chat as an owner uses it: tell Anchored what changed, see the
// reply, wait while it is sending, recover when a send fails, and find no text
// box on the read-only example. Onboarding as an owner finishes it: pick
// several chips at once, confirm, and open the new plan. `fetch` plays the
// chat and intake routes.

const CHAT_URL = "/api/businesses/greenfield/chat";

const GREETING: ChatMessage = { id: "m1", role: "anchored", text: "What changed at Greenfield Lawn?", at: "2026-11-06T14:00:00Z" };
const OWNER_SAID: ChatMessage = { id: "m2", role: "owner", text: "We now do snow removal", at: "2026-11-06T14:01:00Z" };
const REPLY: ChatMessage = { id: "m3", role: "anchored", text: "Noted: snow removal from December.", at: "2026-11-06T14:01:02Z" };

const LOADED: BusinessChatResponse = { messages: [GREETING], changes: [] };
const ANSWERED: BusinessChatResponse = { messages: [GREETING, OWNER_SAID, REPLY], changes: [] };

/** Play the chat route: GET returns `LOADED`, and each POST answers with the next of `posts`. */
function chatRoute(...posts: (Response | Promise<Response>)[]) {
  return stubFetch((url, init) => {
    if (url !== CHAT_URL) throw new Error(`Unexpected request to ${url}`);
    if ((init?.method ?? "GET") === "GET") return json(LOADED);
    const next = posts.shift();
    if (next === undefined) throw new Error("More POSTs than the test planned");
    return next;
  });
}

function thread(): HTMLElement {
  return screen.getByRole("log");
}

function textBox(): HTMLElement {
  return screen.getByRole("textbox", { name: "Message Anchored" });
}

/** Render the chat and wait for its history to load. */
async function renderLoadedChat() {
  render(<ChatWindow mode="business" businessId="greenfield" />);
  await waitFor(() => expect(thread()).toHaveTextContent(GREETING.text));
}

describe("ChatWindow, business mode", () => {
  it("loads the conversation so far", async () => {
    const fetchSpy = chatRoute();

    await renderLoadedChat();

    expect(sentJson(fetchSpy, 0)).toMatchObject({ method: "GET", url: CHAT_URL });
  });

  it("sends what the owner types and shows Anchored's reply", async () => {
    const fetchSpy = chatRoute(json(ANSWERED));
    await renderLoadedChat();

    await userEvent.type(textBox(), "We now do snow removal");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(thread()).toHaveTextContent(REPLY.text));
    expect(sentJson(fetchSpy, 1)).toEqual({ method: "POST", url: CHAT_URL, body: { text: "We now do snow removal" } });
    expect(textBox()).toHaveValue("");
  });

  it("sends on Enter, and Shift+Enter starts a new line instead", async () => {
    const fetchSpy = chatRoute(json(ANSWERED));
    await renderLoadedChat();

    await userEvent.type(textBox(), "We now do{Shift>}{Enter}{/Shift}snow removal");
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(thread()).toHaveTextContent(REPLY.text));
    expect(sentJson(fetchSpy, 1).body).toEqual({ text: "We now do\nsnow removal" });
  });

  it("offers starter messages on a fresh chat and sends the one picked", async () => {
    const fetchSpy = chatRoute(json(ANSWERED));
    await renderLoadedChat();

    const starters = screen.getByRole("group", { name: "Things you can tell Anchored" });
    const [first] = within(starters).getAllByRole("button");
    if (first === undefined) throw new Error("No starter messages");
    await userEvent.click(first);

    await waitFor(() => expect(thread()).toHaveTextContent(REPLY.text));
    expect(sentJson(fetchSpy, 1).body).toEqual({ text: first.textContent });
  });

  it("shows the owner's words at once and blocks a second send until the reply lands", async () => {
    const reply = deferred<Response>();
    const fetchSpy = chatRoute(reply.promise);
    await renderLoadedChat();

    await userEvent.type(textBox(), "We now do snow removal{Enter}");
    expect(thread()).toHaveTextContent("We now do snow removal");

    await userEvent.type(textBox(), "And we close on Sundays");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    reply.resolve(json(ANSWERED));
    await waitFor(() => expect(thread()).toHaveTextContent(REPLY.text));
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("refreshes the page around the chat when a reply changed the plan", async () => {
    const changed: BusinessChatResponse = {
      messages: [GREETING, OWNER_SAID, REPLY],
      changes: [{ op: "added", area: "workflow", label: "Snow removal" }],
    };
    chatRoute(json(changed));
    await renderLoadedChat();

    await userEvent.type(textBox(), "We now do snow removal{Enter}");

    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("links a reply that drafted work to its card in Approvals, and refreshes the approvals count", async () => {
    const asked: ChatMessage = { id: "m4", role: "owner", text: "text Dana we're running 20 minutes late", at: "2026-11-06T14:02:00Z" };
    const drafted: ChatMessage = {
      id: "m5",
      role: "anchored",
      text: "Front Desk drafted a text to Dana. It's waiting in Approvals, and nothing goes out until you approve it.",
      at: "2026-11-06T14:02:02Z",
      card: { key: "greenfield:chat:m5", title: "Text Dana we're running 20 minutes late", status: "pending" },
    };
    const fetchSpy = chatRoute(json({ messages: [GREETING, asked, drafted], changes: [] }));
    await renderLoadedChat();

    await userEvent.type(textBox(), "text Dana we're running 20 minutes late{Enter}");

    const link = await within(thread()).findByRole("link", { name: "Text Dana we're running 20 minutes late, Waiting in Approvals" });
    expect(link).toHaveAttribute("href", "/app/b/greenfield/approvals#card-greenfield-chat-m5");
    expect(thread()).toHaveTextContent("Front Desk drafted a text to Dana");
    expect(sentJson(fetchSpy, 1).body).toEqual({ text: "text Dana we're running 20 minutes late" });
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows when a draft from the chat was approved", async () => {
    const approved: ChatMessage = { ...REPLY, card: { key: "greenfield:chat:m3", title: "Write a post about our fall cleanup", status: "approved" } };
    stubFetch(() => json({ messages: [GREETING, OWNER_SAID, approved], changes: [] }));

    render(<ChatWindow mode="business" businessId="greenfield" />);

    expect(await screen.findByRole("link", { name: "Write a post about our fall cleanup, Approved" })).toBeInTheDocument();
  });

  it("leaves the page alone when a reply changed nothing", async () => {
    chatRoute(json(ANSWERED));
    await renderLoadedChat();

    await userEvent.type(textBox(), "We now do snow removal{Enter}");

    await waitFor(() => expect(thread()).toHaveTextContent(REPLY.text));
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("says why a send failed, keeps the owner's words, and sends again on Try again", async () => {
    const fetchSpy = chatRoute(json({ error: "Anchored is busy. Try again in a minute." }, 503), json(ANSWERED));
    await renderLoadedChat();

    await userEvent.type(textBox(), "We now do snow removal{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Anchored is busy. Try again in a minute.");
    expect(thread()).toHaveTextContent("We now do snow removal");
    expect(thread()).toHaveTextContent("Not sent");

    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(thread()).toHaveTextContent(REPLY.text));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(sentJson(fetchSpy, 2).body).toEqual({ text: "We now do snow removal" });
  });

  it("tells the owner to check their connection when the request never arrives", async () => {
    stubFetch((_url, init) => {
      if ((init?.method ?? "GET") === "GET") return json(LOADED);
      throw new TypeError("Failed to fetch");
    });
    await renderLoadedChat();

    await userEvent.type(textBox(), "We now do snow removal{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent(/connection/i);
  });

  it("says so when the conversation can't load, with a retry", async () => {
    let loads = 0;
    stubFetch(() => {
      loads += 1;
      return loads === 1 ? json({ error: "This business is gone." }, 404) : json(LOADED);
    });
    render(<ChatWindow mode="business" businessId="greenfield" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This business is gone.");
    expect(textBox()).toBeDisabled();

    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(thread()).toHaveTextContent(GREETING.text));
    expect(textBox()).toBeEnabled();
  });

  it("has no text box on the read-only example, only a way to start the owner's own business", async () => {
    const fetchSpy = chatRoute();
    render(<ChatWindow mode="business" businessId="greenfield" readOnly />);
    await waitFor(() => expect(thread()).toHaveTextContent(GREETING.text));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Things you can tell Anchored" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up your business" })).toHaveAttribute("href", "/app/new");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("ChatWindow, text box size", () => {
  function grip(): HTMLElement {
    return screen.getByRole("separator", { name: "Resize the text box" });
  }

  it("lets the owner make the text box taller or shorter from the keyboard, then fit it to their words again", async () => {
    chatRoute();
    await renderLoadedChat();
    expect(grip()).toHaveAttribute("aria-valuetext", "Fits your words");
    const tallest = Number(grip().getAttribute("aria-valuemax"));

    grip().focus();
    await userEvent.keyboard("{End}");
    expect(textBox()).toHaveStyle({ height: `${tallest}px` });

    await userEvent.keyboard("{ArrowDown}");
    expect(textBox()).toHaveStyle({ height: `${tallest - 16}px` });
    expect(grip()).toHaveAttribute("aria-valuetext", `${tallest - 16} pixels tall`);

    await userEvent.keyboard("{Home}");
    expect(textBox()).toHaveStyle({ height: "46px" });

    await userEvent.keyboard("{Enter}");
    expect(grip()).toHaveAttribute("aria-valuetext", "Fits your words");
    expect(textBox().style.height).toBe("");
  });

  it("keeps the size the owner picked on their next visit", async () => {
    chatRoute();
    const first = render(<ChatWindow mode="business" businessId="greenfield" />);
    await waitFor(() => expect(thread()).toHaveTextContent(GREETING.text));
    grip().focus();
    await userEvent.keyboard("{Home}{ArrowUp}{ArrowUp}");
    expect(textBox()).toHaveStyle({ height: "78px" });
    first.unmount();

    chatRoute();
    await renderLoadedChat();

    expect(textBox()).toHaveStyle({ height: "78px" });
  });
});

// =============================================================================
// Onboarding
// =============================================================================

const INTAKE_URL = "/api/intake";
const INTAKE_ID = "intake-1";

/** A chip as the intake route sends it. */
function chip(value: string, label = value): IntakeOption {
  return { value, label, selected: false, suggested: false };
}

const REACH: IntakeQuestion = {
  field: "reach",
  text: "How do customers usually reach you? Pick all that apply.",
  multi: true,
  options: [chip("Phone calls"), chip("Walk-ins"), chip("Email")],
};

const CONFIRM: IntakeQuestion = {
  field: "confirm",
  text: "Here's the profile I'll build your plan from. Does this look right?",
  multi: false,
  options: [chip("yes", "Looks right"), chip("change", "Change something")],
};

/** The intake as the route sends it while `question` waits for an answer. */
function asking(question: IntakeQuestion): IntakeResponse {
  return { messages: [{ id: "q", role: "anchored", text: question.text, at: "2026-11-07T14:00:00Z" }], known: [], question, done: false };
}

/** Play the intake routes: POST /api/intake opens on `first`, and each answer gets the next of `answers`. */
function intakeRoute(first: IntakeQuestion, ...answers: IntakeResponse[]) {
  return stubFetch((url) => {
    if (url === INTAKE_URL) return json({ ...asking(first), intakeId: INTAKE_ID } satisfies StartIntakeResponse);
    if (url !== `${INTAKE_URL}/${INTAKE_ID}`) throw new Error(`Unexpected request to ${url}`);
    const next = answers.shift();
    if (next === undefined) throw new Error("More answers than the test planned");
    return json(next);
  });
}

describe("ChatWindow, onboarding", () => {
  it("lets the owner pick several chips, counts them on Done, and sends them together", async () => {
    const fetchSpy = intakeRoute(REACH, asking(CONFIRM));
    render(<ChatWindow mode="intake" />);
    const chips = await screen.findByRole("group", { name: "Pick all that apply, then Done" });

    await userEvent.click(within(chips).getByRole("button", { name: "Phone calls" }));
    await userEvent.click(within(chips).getByRole("button", { name: "Email" }));

    expect(within(chips).getByRole("button", { name: "Phone calls" })).toHaveAttribute("aria-pressed", "true");
    expect(within(chips).getByRole("button", { name: "Walk-ins" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(within(chips).getByRole("button", { name: "Done (2)" }));

    await screen.findByRole("button", { name: "Looks right" });
    expect(sentJson(fetchSpy, 1)).toMatchObject({ method: "POST", url: `${INTAKE_URL}/${INTAKE_ID}`, body: { picks: ["Phone calls", "Email"] } });
  });

  it("counts progress against the planned questions, so details found along the way never move the total", async () => {
    const planned = ["name", "kind", "what", "reach", "tools", "signals", "languages", "week", "voice"] as const;
    const known = [
      ...planned.map((field, i) => ({ field, label: field, value: i < 3 ? "x" : null, state: i < 3 ? ("known" as const) : ("open" as const) })),
      { field: "prices" as const, label: "Prices", value: "Service call $129", state: "known" as const },
      { field: "vocabulary" as const, label: "Your words", value: "customers", state: "known" as const },
    ];
    stubFetch((url) => (url === INTAKE_URL ? json({ ...asking(REACH), known, intakeId: INTAKE_ID } satisfies StartIntakeResponse) : json(asking(REACH))));
    render(<ChatWindow mode="intake" />);

    expect((await screen.findAllByText("3 of 9")).length).toBeGreaterThan(0);
    expect(screen.queryByText("5 of 11")).toBeNull();
  });

  it("opens the new plan on the Workflows page once the owner confirms", async () => {
    intakeRoute(CONFIRM, { ...asking(CONFIRM), question: null, done: true, businessId: "biz-7" });
    render(<ChatWindow mode="intake" />);

    await userEvent.click(await screen.findByRole("button", { name: "Looks right" }));
    await userEvent.click(await screen.findByRole("button", { name: "Open your plan" }));

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/app/b/biz-7/workflows");
    expect(router.refresh).toHaveBeenCalled();
  });
});
