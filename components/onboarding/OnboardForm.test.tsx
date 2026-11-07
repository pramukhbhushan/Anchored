import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { OnboardForm } from "@/components/onboarding/OnboardForm";
import { ToastProvider } from "@/components/ui/Toast";
import { router } from "@/test/next";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// The one-page onboarding form as an owner fills it in: it starts empty,
// suggests boxes for the kind of business typed, sends the answers and opens
// the new plan, or says what is missing or what went wrong.

function renderForm(aiName: string | null = null) {
  return render(
    <ToastProvider>
      <OnboardForm aiName={aiName} />
    </ToastProvider>,
  );
}

function created(): Response {
  return json({ id: "biz-42", business: { name: "Greenfield Lawn & Landscape" } });
}

const nameField = () => screen.getByRole("textbox", { name: "Business name and town" });
const kindField = () => screen.getByRole("textbox", { name: "What kind of business is it?" });
const submit = () => screen.getByRole("button", { name: "Build my plan" });

/** Type the two answers the form needs before it sends anything. */
async function fillRequired(): Promise<void> {
  await userEvent.type(nameField(), "Greenfield Lawn & Landscape, Bowie, MD");
  await userEvent.type(kindField(), "Landscaping company");
}

describe("OnboardForm", () => {
  it("starts empty, with nothing ticked but English", () => {
    renderForm();

    expect(nameField()).toHaveValue("");
    expect(kindField()).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "English" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Spanish" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Google" })).not.toBeChecked();
  });

  it("sends the owner's answers, opens the new plan and refreshes the shell to list it", async () => {
    const fetchSpy = stubFetch(() => created());
    renderForm();

    await fillRequired();
    for (const box of ["Phone calls", "Referrals", "Google", "Spanish"]) {
      await userEvent.click(screen.getByRole("checkbox", { name: box }));
    }
    await userEvent.click(submit());

    await waitFor(() => expect(router.push).toHaveBeenCalledExactlyOnceWith("/app/b/biz-42"));
    expect(router.refresh).toHaveBeenCalled();
    const sent = sentJson(fetchSpy, 0);
    expect(sent).toMatchObject({ method: "POST", url: "/api/businesses" });
    expect(sent.body).toEqual({
      from: "answers",
      answers: expect.objectContaining({
        name: "Greenfield Lawn & Landscape, Bowie, MD",
        kind: "Landscaping company",
        reach: expect.arrayContaining(["Phone calls", "Referrals", "Google"]),
        languages: expect.arrayContaining(["English", "Spanish"]),
      }),
    });
    expect(await screen.findByText(/Greenfield Lawn & Landscape/)).toHaveRole("status");
  });

  it("sends the boxes the owner ticks and leaves out the ones they untick", async () => {
    const fetchSpy = stubFetch(() => created());
    renderForm();

    await fillRequired();
    await userEvent.click(screen.getByRole("checkbox", { name: "Korean" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Spanish" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Spanish" }));
    await userEvent.click(submit());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    const { answers } = sentJson(fetchSpy, 0).body as { answers: { languages: string[] } };
    expect(answers.languages).toEqual(expect.arrayContaining(["English", "Korean"]));
    expect(answers.languages).not.toContain("Spanish");
  });

  it("sends the trimmed text the owner typed", async () => {
    const fetchSpy = stubFetch(() => created());
    renderForm();

    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "  Rosa's Taqueria, Hyattsville  ");
    await userEvent.clear(kindField());
    await userEvent.type(kindField(), "Taco restaurant");
    await userEvent.click(submit());

    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
    expect(sentJson(fetchSpy, 0).body).toMatchObject({ answers: { name: "Rosa's Taqueria, Hyattsville", kind: "Taco restaurant" } });
  });

  it("asks for the name and kind of business before sending anything", async () => {
    const fetchSpy = stubFetch(() => created());
    renderForm();

    await userEvent.clear(nameField());
    await userEvent.click(submit());

    expect(screen.getByRole("status")).toHaveTextContent(/business name/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("suggests boxes for the kind of business, and a tapped suggestion ticks its box", async () => {
    renderForm();

    await userEvent.clear(kindField());
    await userEvent.type(kindField(), "Restaurant");
    const catering = screen.getByRole("button", { name: "Takes catering" });
    expect(catering).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("checkbox", { name: "I take catering or event orders" })).not.toBeChecked();

    await userEvent.click(catering);

    expect(catering).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("checkbox", { name: "I take catering or event orders" })).toBeChecked();
  });

  it("ticks nothing from the kind of business alone", async () => {
    renderForm();

    await userEvent.clear(kindField());
    await userEvent.type(kindField(), "Restaurant");

    expect(screen.getByRole("checkbox", { name: "I take catering or event orders" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Delivery apps" })).not.toBeChecked();
  });

  it("shows no suggestions when the kind of business is empty", async () => {
    renderForm();

    await userEvent.clear(kindField());

    expect(screen.queryByRole("button", { name: "Sends quotes" })).not.toBeInTheDocument();
  });

  it("holds the button and names the AI provider while the plan is built", async () => {
    const answer = deferred<Response>();
    stubFetch(() => answer.promise);
    renderForm("Claude");

    await fillRequired();
    await userEvent.click(submit());

    expect(submit()).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/Claude/);
    answer.resolve(created());
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it("says what went wrong and lets the owner try again", async () => {
    stubFetch(() => json({ error: "Anchored couldn't read those answers. Try shorter ones." }, 422));
    renderForm();

    await fillRequired();
    await userEvent.click(submit());

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Anchored couldn't read those answers. Try shorter ones."));
    expect(submit()).toBeEnabled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
