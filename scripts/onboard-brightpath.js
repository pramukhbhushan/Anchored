// Onboard the Brightpath Coaching test business automatically, for testing.
//
// How to use:
//   1. Open http://localhost:3102/app in your browser.
//   2. Open DevTools (Cmd+Option+J in Chrome), go to the Console tab.
//   3. Paste this whole file and press Enter.
//
// It starts an onboarding chat in your own browser session, answers every
// question from docs/testing/brightpath-persona.md, logs each question and answer,
// and opens the new business's Workflows map when it's done. Questions it has no
// answer for are skipped. Only for local testing.

(async () => {
  // One answer per question. `picks` are used when the question offers those chips; `text` otherwise.
  const ANSWERS = {
    name: { text: "Brightpath Coaching, College Park" },
    kind: { text: "Career coaching agency" },
    what: {
      text: "We sell 1-on-1 career coaching to early and mid-career professionals in the DC area. A single coaching session is $175, interview prep (2 sessions) is $300, a career coaching package (3 sessions) is $450, a leadership workshop seat is $600, and an executive coaching retainer is $1,200 a month. Most clients are referred or find us on LinkedIn.",
    },
    reach: {
      picks: ["Email", "Website form", "Referrals", "Instagram or Facebook"],
      text: "Email, LinkedIn messages, our website booking form, and referrals.",
    },
    tools: {
      picks: ["Google Sheets", "Gmail", "Calendly"],
      text: "Google Sheets, Gmail, Calendly and Zoom.",
    },
    signals: { picks: ["appointments", "memberships", "marketing"] },
    languages: { picks: ["English"], text: "English" },
    week: {
      text: "Chasing clients who pay their invoices late, following up on new leads from LinkedIn and email, and reminding clients about upcoming sessions.",
    },
    voice: {
      text: "Hi Maya, thanks for reaching out! I'd love to help you get ready for your interviews. I have openings Tuesday at 10 a.m. or Thursday at 2 p.m. this week. Let me know which works best and I'll send a Calendly link. Looking forward to working with you! Best, Priya at Brightpath Coaching",
    },
    confirm: { picks: ["yes"] },
    "gap:ownerName": { text: "Priya" },
    "gap:vocabulary": { text: "Clients, and a coaching session" },
    "gap:hours": { text: "Mon to Fri 9 a.m. to 6 p.m." },
    "gap:pricingMethod": { picks: ["packages"], text: "Packages" },
    "gap:prices": {
      text: "Single session $175, interview prep $300, 3-session package $450, workshop seat $600, executive retainer $1,200 a month",
    },
    "gap:minimumCharge": { text: "$175" },
    "gap:urgentCriteria": {
      text: "A client canceling or rescheduling a session for today or tomorrow, a new lead asking to start this week, or a client saying they were charged twice or can't pay an invoice.",
    },
    "gap:reminderFirmness": { picks: ["gentle"], text: "Gentle" },
    "gap:nextStep": { picks: ["book_call"], text: "Book a call" },
  };

  const post = async (url, body) => {
    const response = await fetch(url, {
      method: "POST",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json();
    if (!response.ok)
      throw new Error(`${url}: ${json.error ?? response.status}`);
    return json;
  };

  /** Pick the request for one question: the planned chips when offered, else the typed answer, else skip. */
  const answerFor = (question) => {
    const planned = ANSWERS[question.field];
    const offered = new Set(
      (question.options ?? []).map((option) => option.value),
    );
    if (planned?.picks && planned.picks.every((pick) => offered.has(pick)))
      return { picks: planned.picks };
    if (planned?.text) return { text: planned.text };
    // A guess Anchored offers to confirm, with nothing planned for it: accept it.
    if (offered.has("yes")) return { picks: ["yes"] };
    return { text: "skip" };
  };

  let state = await post("/api/intake");
  const intakeId = state.intakeId;
  for (let turn = 1; turn <= 40 && state.question; turn += 1) {
    const question = state.question;
    const answer = answerFor(question);
    console.log(
      `%c${turn}. [${question.field}] ${question.text}`,
      "font-weight:bold",
      "\n   ->",
      answer.picks ? `tapped ${answer.picks.join(", ")}` : answer.text,
    );
    state = await post(`/api/intake/${intakeId}`, answer);
  }

  if (!state.businessId) {
    console.warn("Onboarding didn't finish. Last question:", state.question);
    return;
  }
  console.log(
    "%cDone. Anchored said:",
    "font-weight:bold",
    state.messages.at(-1)?.text,
  );
  location.href = `/app/b/${encodeURIComponent(state.businessId)}/workflows`;
})();
