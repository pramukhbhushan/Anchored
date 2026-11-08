import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostPreview, moved } from "@/components/business/PostPreview";
import type { PostDraft } from "@/lib/domain/posts";
import { stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// A photo post as the owner reviews it: photos in posting order with their slide
// words and buttons to reorder them, a caption tab per platform to edit, Copy
// caption, Download photos on a laptop, and Share on a phone that can hand files
// to another app. `onChange` reports the caption on screen. `fetch` serves the
// photos.

const POST: PostDraft = {
  description: "Before and after of a furnace replacement",
  photos: [
    { id: "a", url: "/api/businesses/b1/photos/a" },
    { id: "b", url: "/api/businesses/b1/photos/b" },
  ],
  formats: { instagram: { id: "before-after", name: "Before and after" }, facebook: { id: "before-after", name: "Before and after" }, linkedin: { id: "on-the-job", name: "On the job today" } },
  captions: {
    instagram: "Same basement. One day apart.\n\n#HVAC #CollegePark #Furnace",
    facebook: "Hey College Park, a furnace swap we just finished.\n\n#HVAC #CollegePark",
    linkedin: "A furnace replacement we finished in College Park.\n\n#HVAC #SmallBusiness #CollegePark",
  },
  written: { instagram: "ai", facebook: "ai", linkedin: "template" },
  slides: ["The old furnace", "The new one running"],
};

/** Serve each photo URL as a small JPEG. */
function photosRoute() {
  return stubFetch((url) => new Response(new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" }), { status: url.includes("/photos/") ? 200 : 404 }));
}

function renderPost(onChange = vi.fn()) {
  render(<PostPreview post={POST} disabled={false} onChange={onChange} />);
  return onChange;
}

const photoAlts = () => within(screen.getByRole("list", { name: "Photos, in posting order" })).getAllByRole("img").map((img) => img.getAttribute("src"));

beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:photo"), revokeObjectURL: vi.fn() }));
});

afterEach(() => {
  vi.restoreAllMocks();
  // @ts-expect-error The test adds share support to the navigator and takes it away again.
  delete navigator.canShare;
  // @ts-expect-error Same as above.
  delete navigator.share;
});

describe("moved", () => {
  it("swaps an item with its neighbor, and leaves the ends alone", () => {
    expect(moved(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]);
    expect(moved(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]);
    expect(moved(["a", "b"], 0, -1)).toEqual(["a", "b"]);
  });
});

describe("PostPreview", () => {
  it("shows the photos in order with their slide words, and the Instagram caption first", () => {
    renderPost();

    expect(photoAlts()).toEqual([POST.photos[0]!.url, POST.photos[1]!.url]);
    expect(screen.getByText("The old furnace")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Instagram" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: /Instagram caption, following the "Before and after" format/ })).toHaveValue(POST.captions.instagram);
    expect(screen.getByText(/3 hashtags/)).toBeInTheDocument();
  });

  it("switches to each platform's caption and reports it to the card", async () => {
    const user = userEvent.setup();
    const onChange = renderPost();

    await user.click(screen.getByRole("tab", { name: "LinkedIn" }));

    expect(screen.getByRole("tab", { name: "LinkedIn" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("textbox", { name: /LinkedIn caption, following the "On the job today" format/ })).toHaveValue(POST.captions.linkedin);
    expect(screen.getByText(/Written from Anchored's template/)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({ platform: "linkedin", caption: POST.captions.linkedin });
  });

  it("lets the owner edit a caption and keeps each platform's edits", async () => {
    const user = userEvent.setup();
    const onChange = renderPost();

    const box = screen.getByRole("textbox", { name: /Instagram caption/ });
    await user.clear(box);
    await user.type(box, "Swapped a rusty furnace. #HVAC #CollegePark #Furnace");
    expect(onChange).toHaveBeenLastCalledWith({ platform: "instagram", caption: "Swapped a rusty furnace. #HVAC #CollegePark #Furnace" });

    await user.click(screen.getByRole("tab", { name: "Facebook" }));
    await user.click(screen.getByRole("tab", { name: "Instagram" }));
    expect(screen.getByRole("textbox", { name: /Instagram caption/ })).toHaveValue("Swapped a rusty furnace. #HVAC #CollegePark #Furnace");
  });

  it("reorders the photos", async () => {
    const user = userEvent.setup();
    renderPost();

    expect(screen.getByRole("button", { name: "Move photo 1 earlier" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move photo 1 later" }));

    expect(photoAlts()).toEqual([POST.photos[1]!.url, POST.photos[0]!.url]);
    expect(screen.getByRole("list", { name: "Photos, in posting order" })).toHaveTextContent(/The new one running.*The old furnace/);
  });

  it("copies the caption on screen", async () => {
    const user = userEvent.setup();
    renderPost();

    await user.click(screen.getByRole("tab", { name: "Facebook" }));
    await user.click(screen.getByRole("button", { name: "Copy caption" }));

    expect(await navigator.clipboard.readText()).toBe(POST.captions.facebook);
    expect(screen.getByRole("status")).toHaveTextContent("Facebook caption copied.");
  });

  it("downloads the photos in posting order on a laptop", async () => {
    const user = userEvent.setup();
    const fetchSpy = photosRoute();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    renderPost();

    await user.click(screen.getByRole("button", { name: "Move photo 1 later" }));
    await user.click(screen.getByRole("button", { name: "Download photos" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Downloaded 2 photos, in posting order."));
    expect(names).toEqual(["photo-1.jpg", "photo-2.jpg"]);
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toEqual([POST.photos[1]!.url, POST.photos[0]!.url]);
    expect(screen.queryByRole("button", { name: "Share" })).not.toBeInTheDocument();
  });

  it("offers Download beside Share, so a laptop that can share still saves the photos", async () => {
    photosRoute();
    Object.assign(navigator, { canShare: () => true, share: vi.fn() });
    renderPost();

    expect(await screen.findByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download photos" })).toBeInTheDocument();
  });

  it("shares the photos and caption to another app on a phone, with the caption also on the clipboard", async () => {
    const user = userEvent.setup();
    photosRoute();
    const share = vi.fn(async (_data: ShareData) => undefined);
    Object.assign(navigator, { canShare: () => true, share });
    renderPost();

    const button = await screen.findByRole("button", { name: "Share" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const data = share.mock.calls[0]![0];
    expect(data.text).toBe(POST.captions.instagram);
    expect(data.files?.map((f) => f.name)).toEqual(["photo-1.jpg", "photo-2.jpg"]);
    expect(await navigator.clipboard.readText()).toBe(POST.captions.instagram);
  });

  it("points to Download when sharing fails", async () => {
    const user = userEvent.setup();
    photosRoute();
    Object.assign(navigator, { canShare: () => true, share: vi.fn(async () => Promise.reject(new Error("not allowed"))) });
    renderPost();

    const button = await screen.findByRole("button", { name: "Share" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);

    expect(await screen.findByText("Sharing didn't work here. Use Download photos instead.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download photos" })).toBeEnabled();
  });
});
