import { describe, expect, it } from "vitest";
import { fetchPage, isPublicWebUrl, readableText } from "./fetch-page";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the page fetcher the discovery agent uses to confirm a vendor's
// site: which addresses it refuses to load, what it reads from a page, and when
// it gives up. A stand-in `fetch` answers every request.

const PRICING_HTML = `<!doctype html><html><head><title>Weave &amp; Co | Pricing</title>
<meta name="description" content="Phones and texting for dental offices">
<style>.x{color:red}</style><script>window.secret = "ignore me";</script></head>
<body><h1>Weave pricing</h1><p>From&nbsp;$249 a month.</p><!-- hidden --></body></html>`;

/** A `fetch` stand-in that answers with `body` and `headers`, recording each address it was asked for. */
function fakeFetch(body: string, init: { status?: number; contentType?: string; finalUrl?: string } = {}) {
  const asked: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    asked.push(String(input));
    const response = new Response(body, { status: init.status ?? 200, headers: { "content-type": init.contentType ?? "text/html; charset=utf-8" } });
    if (init.finalUrl) Object.defineProperty(response, "url", { value: init.finalUrl });
    return response;
  };
  return { fetchImpl, asked };
}

describe("isPublicWebUrl", () => {
  it("allows a vendor's https page", () => {
    expect(isPublicWebUrl("https://www.getweave.com/pricing")).toBe(true);
  });

  it.each([
    "http://localhost:3000/",
    "http://127.0.0.1/",
    "http://10.0.0.5/admin",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://intranet/",
    "https://getweave.com:8443/",
    "ftp://getweave.com/",
    "https://user@getweave.com/",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isPublicWebUrl(url)).toBe(false);
  });
});

describe("readableText", () => {
  it("keeps the title, description and visible text, and drops scripts, styles and comments", () => {
    expect(readableText(PRICING_HTML)).toEqual({
      title: "Weave & Co | Pricing",
      text: "Phones and texting for dental offices Weave pricing From $249 a month.",
    });
  });
});

describe("fetchPage", () => {
  it("returns the page's address, title and text", async () => {
    const { fetchImpl } = fakeFetch(PRICING_HTML);

    expect(await fetchPage("https://www.getweave.com/pricing", { fetchImpl })).toEqual({
      url: "https://www.getweave.com/pricing",
      title: "Weave & Co | Pricing",
      text: "Phones and texting for dental offices Weave pricing From $249 a month.",
    });
  });

  it("never asks for a private address", async () => {
    const { fetchImpl, asked } = fakeFetch(PRICING_HTML);

    expect(await fetchPage("http://169.254.169.254/latest/meta-data", { fetchImpl })).toBeNull();
    expect(asked).toEqual([]);
  });

  it("drops a page that redirects to a private address", async () => {
    const { fetchImpl } = fakeFetch(PRICING_HTML, { finalUrl: "http://127.0.0.1/admin" });

    expect(await fetchPage("https://www.getweave.com/pricing", { fetchImpl })).toBeNull();
  });

  it("drops an error page, a file that isn't HTML and a page over the size cap", async () => {
    expect(await fetchPage("https://getweave.com/", { fetchImpl: fakeFetch("gone", { status: 404 }).fetchImpl })).toBeNull();
    expect(await fetchPage("https://getweave.com/a.pdf", { fetchImpl: fakeFetch("%PDF", { contentType: "application/pdf" }).fetchImpl })).toBeNull();
    expect(await fetchPage("https://getweave.com/", { fetchImpl: fakeFetch(PRICING_HTML).fetchImpl, maxBytes: 50 })).toBeNull();
  });

  it("returns nothing when the request fails", async () => {
    const failing: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };

    expect(await fetchPage("https://getweave.com/", { fetchImpl: failing })).toBeNull();
  });

  it("cuts long pages to the character cap", async () => {
    const page = await fetchPage("https://getweave.com/", { fetchImpl: fakeFetch(PRICING_HTML).fetchImpl, maxChars: 20 });

    expect(page?.text).toBe("Phones and texting f");
  });
});
