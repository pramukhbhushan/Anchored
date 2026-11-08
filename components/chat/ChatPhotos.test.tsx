import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatWindow } from "@/components/chat/ChatWindow";
import type { BusinessChatResponse, ChatMessage } from "@/lib/api/contract";
import { POST_BRIEF_QUESTION } from "@/lib/domain/posts";
import { deferred, json, sentJson, stubFetch } from "@/test/http";

// =============================================================================
// Module Overview
// =============================================================================
// Photos in the business chat, as an owner adds them for a post: each photo
// uploads as soon as it's picked, Send waits for every upload and a line saying
// what the photos show, a failed photo says why and can be taken out, a post
// holds at most 10 photos, and the message carries the photo ids in order.
// `fetch` plays the chat and photo routes.

const CHAT_URL = "/api/businesses/greenfield/chat";
const PHOTOS_URL = "/api/businesses/greenfield/photos";
const GREETING: ChatMessage = { id: "m1", role: "anchored", text: "What changed at Greenfield Lawn?", at: "2026-11-06T14:00:00Z" };
const LOADED: BusinessChatResponse = { messages: [GREETING], changes: [] };
const DRAFTED: BusinessChatResponse = {
  messages: [
    GREETING,
    { id: "m2", role: "owner", text: "Before and after of a patio", at: "2026-11-06T14:01:00Z" },
    { id: "m3", role: "anchored", text: 'Content and Social drafted a "Before and after" post from your 2 photos.', at: "2026-11-06T14:01:20Z", card: { key: "greenfield:chat:m3", title: "Post: Before and after of a patio", status: "pending" } },
  ],
  changes: [],
};

/** A photo id the route hands back for the `n`th upload. */
const photoId = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** `count` small JPEG files, as a phone's picker would hand them over. */
function jpegs(count: number): File[] {
  return Array.from({ length: count }, (_, i) => new File([new Uint8Array([0xff, 0xd8, 0xff, i])], `job-${i + 1}.jpg`, { type: "image/jpeg" }));
}

/** Play the chat and photo routes. `upload` answers each photo; the chat POST answers `sent`, `DRAFTED` by default. */
function routes(upload: (n: number) => Response | Promise<Response> = (n) => json({ photo: { id: photoId(n), url: `${PHOTOS_URL}/${photoId(n)}` } }, 201), sent: BusinessChatResponse = DRAFTED) {
  let uploads = 0;
  return stubFetch((url, init) => {
    if (url === PHOTOS_URL) return upload(++uploads);
    if (url !== CHAT_URL) throw new Error(`Unexpected request to ${url}`);
    return (init?.method ?? "GET") === "GET" ? json(LOADED) : json(sent);
  });
}

async function renderChat() {
  render(<ChatWindow mode="business" businessId="greenfield" />);
  await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(GREETING.text));
}

const textBox = () => screen.getByRole("textbox", { name: "Message Anchored" });
const sendButton = () => screen.getByRole("button", { name: "Send" });
const photoInput = () => screen.getByTestId("photo-input");

beforeEach(() => {
  // Previews use object URLs, which the test DOM doesn't make.
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
  // The test DOM can't decode images, so photos go up as picked, as in a browser without image decoding.
  vi.stubGlobal("createImageBitmap", undefined);
});

describe("photos in the business chat", () => {
  it("uploads each photo as it's added and sends their ids, in order, with the owner's words", async () => {
    const user = userEvent.setup();
    const fetchSpy = routes();
    await renderChat();

    await user.upload(photoInput(), jpegs(2));

    const tray = screen.getByRole("list", { name: "Photos for your post, 2 added" });
    expect(within(tray).getAllByRole("img")).toHaveLength(2);
    await waitFor(() => expect(screen.queryByText(/Uploading photo/)).not.toBeInTheDocument());
    const uploads = fetchSpy.mock.calls.filter(([url]) => String(url) === PHOTOS_URL);
    expect(uploads).toHaveLength(2);
    expect(uploads[0]?.[1]).toMatchObject({ method: "POST", headers: { "content-type": "image/jpeg" } });

    expect(textBox()).toHaveAttribute("placeholder", POST_BRIEF_QUESTION);
    expect(sendButton()).toBeDisabled();
    await user.type(textBox(), "Before and after of a patio");
    await user.click(sendButton());

    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("drafted a \"Before and after\" post"));
    const chatPost = fetchSpy.mock.calls.findIndex(([url, init]) => String(url) === CHAT_URL && init?.method === "POST");
    expect(sentJson(fetchSpy, chatPost).body).toEqual({ text: "Before and after of a patio", photos: [photoId(1), photoId(2)] });
    expect(screen.queryByRole("list", { name: /Photos for your post/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Post: Before and after of a patio/ })).toBeInTheDocument();
  });

  it("keeps Send off until every photo has uploaded", async () => {
    const user = userEvent.setup();
    const held = deferred<Response>();
    routes(() => held.promise);
    await renderChat();

    await user.upload(photoInput(), jpegs(1));
    await user.type(textBox(), "New furnace");
    expect(screen.getByText("Uploading photo 1")).toBeInTheDocument();
    expect(sendButton()).toBeDisabled();

    held.resolve(json({ photo: { id: photoId(1), url: "x" } }, 201));
    await waitFor(() => expect(sendButton()).toBeEnabled());
  });

  it("says why a photo failed, and sends once the owner takes it out", async () => {
    const user = userEvent.setup();
    routes((n) => (n === 1 ? json({ error: "That file isn't a JPEG, PNG or WebP photo. Try another photo." }, 400) : json({ photo: { id: photoId(n), url: "x" } }, 201)));
    await renderChat();

    await user.upload(photoInput(), jpegs(2));
    await user.type(textBox(), "New furnace");

    expect(await screen.findByRole("alert")).toHaveTextContent("That file isn't a JPEG, PNG or WebP photo. Try another photo. Remove it to send the rest.");
    expect(sendButton()).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Remove photo 1" }));
    expect(screen.getByRole("list", { name: "Photos for your post, 1 added" })).toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it("explains a photo this browser can't open, such as an iPhone HEIC in Chrome, and uploads nothing", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => Promise.reject(new Error("decode failed"))));
    const fetchSpy = routes();
    await renderChat();

    await user.upload(photoInput(), [new File([new Uint8Array([1, 2, 3])], "IMG_0001.heic", { type: "image/heic" })]);

    expect(await screen.findByRole("alert")).toHaveTextContent("This photo couldn't be opened here. Try a JPEG or PNG, or take a screenshot of it.");
    expect(fetchSpy.mock.calls.filter(([url]) => String(url) === PHOTOS_URL)).toHaveLength(0);
  });

  it("holds at most 10 photos and says how many were left out", async () => {
    const user = userEvent.setup();
    const fetchSpy = routes();
    await renderChat();

    await user.upload(photoInput(), jpegs(12));

    expect(screen.getByRole("list", { name: "Photos for your post, 10 added" })).toBeInTheDocument();
    expect(screen.getByText("A post holds up to 10 photos, so 2 weren't added.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Photo limit reached" })).toBeDisabled();
    await waitFor(() => expect(fetchSpy.mock.calls.filter(([url]) => String(url) === PHOTOS_URL)).toHaveLength(10));
  });

  it("sends a message with no photos just as before", async () => {
    const user = userEvent.setup();
    const fetchSpy = routes();
    await renderChat();

    await user.type(textBox(), "We now do snow removal");
    await user.click(sendButton());

    await waitFor(() => expect(fetchSpy.mock.calls.some(([url, init]) => String(url) === CHAT_URL && init?.method === "POST")).toBe(true));
    const chatPost = fetchSpy.mock.calls.findIndex(([url, init]) => String(url) === CHAT_URL && init?.method === "POST");
    expect(sentJson(fetchSpy, chatPost).body).toEqual({ text: "We now do snow removal" });
  });

  it("offers no photo button on the read-only example", async () => {
    routes();
    render(<ChatWindow mode="business" businessId="greenfield" readOnly />);
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(GREETING.text));
    expect(screen.queryByRole("button", { name: "Add photos for a post" })).not.toBeInTheDocument();
  });

  it("keeps the photos and puts the words back when Anchored didn't draft a post, so the owner can resend", async () => {
    const user = userEvent.setup();
    const refused: BusinessChatResponse = {
      messages: [GREETING, { id: "m2", role: "owner", text: "New patio", at: "2026-11-06T14:01:00Z" }, { id: "m3", role: "anchored", text: "I can draft posts from your photos, but post drafts are off.", at: "2026-11-06T14:01:01Z" }],
      changes: [],
      keepComposer: true,
    };
    routes(undefined, refused);
    await renderChat();

    await user.upload(photoInput(), jpegs(2));
    await user.type(textBox(), "New patio");
    await waitFor(() => expect(sendButton()).toBeEnabled());
    await user.click(sendButton());

    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("post drafts are off"));
    expect(textBox()).toHaveValue("New patio");
    expect(screen.getByRole("list", { name: "Photos for your post, 2 added" })).toBeInTheDocument();
    expect(sendButton()).toBeEnabled();
  });

  it("starts the text box with words carried from an automation page", async () => {
    routes();
    render(<ChatWindow mode="business" businessId="greenfield" ask="Our open house" />);
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent(GREETING.text));
    expect(textBox()).toHaveValue("Our open house");
  });
});
