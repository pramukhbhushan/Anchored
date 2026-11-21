import { describe, expect, it } from "vitest";
import { fetchPage, isPublicAddress, isPublicWebUrl, readableText } from "./fetch-page";

// =============================================================================
// Module Overview
// =============================================================================
// Behavior of the page fetcher that loads an owner's website and a vendor's site:
// which addresses it refuses to load, by URL text and by DNS answer, how it walks
// redirects, what it reads from a page, and when it gives up. A stand-in `fetch`
// answers every request and a stand-in resolver answers every DNS lookup.

const PRICING_HTML = `<!doctype html><html><head><title>Weave &amp; Co | Pricing</title>
<meta name="description" content="Phones and texting for dental offices">
<style>.x{color:red}</style><script>window.secret = "ignore me";</script></head>
<body><h1>Weave pricing</h1><p>From&nbsp;$249 a month.</p><!-- hidden --></body></html>`;

const PUBLIC_IP = "34.120.10.20";

/** A resolver stand-in: names in `answers` get those addresses, every other name gets one public address. */
function fakeResolve(answers: Readonly<Record<string, readonly string[]>> = {}) {
  const looked: string[] = [];
  const resolveHost = async (hostname: string) => {
    looked.push(hostname);
    return (answers[hostname] ?? [PUBLIC_IP]).map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  };
  return { resolveHost, looked };
}

/** A `fetch` stand-in that answers with `body` and `headers`, recording each address it was asked for. */
function fakeFetch(body: string, init: { status?: number; contentType?: string } = {}) {
  const asked: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    asked.push(String(input));
    return new Response(body, { status: init.status ?? 200, headers: { "content-type": init.contentType ?? "text/html; charset=utf-8" } });
  };
  return { fetchImpl, asked, resolveHost: fakeResolve().resolveHost };
}

/** A `fetch` stand-in that redirects each address in `hops` to the next, then serves the page. */
function redirectingFetch(hops: Readonly<Record<string, string>>) {
  const asked: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    asked.push(url);
    if (init?.redirect !== "manual") throw new Error("fetchPage must follow redirects itself");
    const next = hops[url];
    if (next !== undefined) return new Response(null, { status: 302, headers: { location: next } });
    return new Response(PRICING_HTML, { status: 200, headers: { "content-type": "text/html" } });
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

describe("isPublicAddress", () => {
  it.each([PUBLIC_IP, "8.8.8.8", "2606:4700::6810:84e5"])("allows %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.0.10",
    "169.254.169.254",
    "100.100.100.200",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:a9fe:a9fe",
    "64:ff9b::a9fe:a9fe",
    "fd00:ec2::254",
    "fe80::1",
    "fe80::1%en0",
    "ff02::1",
    "2001:db8::1",
    "2002:7f00:1::",
    "not an address",
  ])("refuses %s", (address) => {
    expect(isPublicAddress(address)).toBe(false);
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
    const { fetchImpl, resolveHost } = fakeFetch(PRICING_HTML);

    expect(await fetchPage("https://www.getweave.com/pricing", { fetchImpl, resolveHost })).toEqual({
      url: "https://www.getweave.com/pricing",
      title: "Weave & Co | Pricing",
      text: "Phones and texting for dental offices Weave pricing From $249 a month.",
    });
  });

  it("never asks for a private address", async () => {
    const { fetchImpl, asked, resolveHost } = fakeFetch(PRICING_HTML);

    expect(await fetchPage("http://169.254.169.254/latest/meta-data", { fetchImpl, resolveHost })).toBeNull();
    expect(asked).toEqual([]);
  });

  it.each([
    ["a private IPv4 address", ["10.0.0.5"]],
    ["the cloud metadata address", ["169.254.169.254"]],
    ["IPv6 loopback", ["::1"]],
    ["an IPv4 loopback mapped into IPv6", ["::ffff:127.0.0.1"]],
    ["one private address among public ones", [PUBLIC_IP, "192.168.1.1"]],
    ["no address at all", []],
  ])("never asks for a public name that resolves to %s", async (_label, addresses) => {
    const { fetchImpl, asked } = fakeFetch(PRICING_HTML);
    const { resolveHost, looked } = fakeResolve({ "sneaky.example.com": addresses });

    expect(await fetchPage("https://sneaky.example.com/", { fetchImpl, resolveHost })).toBeNull();
    expect(looked).toEqual(["sneaky.example.com"]);
    expect(asked).toEqual([]);
  });

  it("returns nothing when the name doesn't resolve", async () => {
    const { fetchImpl, asked } = fakeFetch(PRICING_HTML);
    const failing = async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    };

    expect(await fetchPage("https://gone.example.com/", { fetchImpl, resolveHost: failing })).toBeNull();
    expect(asked).toEqual([]);
  });

  it("never requests a redirect hop whose name resolves to a private address", async () => {
    const { fetchImpl, asked } = redirectingFetch({ "https://www.getweave.com/": "https://internal.example.com/admin" });
    const { resolveHost } = fakeResolve({ "internal.example.com": ["169.254.169.254"] });

    expect(await fetchPage("https://www.getweave.com/", { fetchImpl, resolveHost })).toBeNull();
    expect(asked).toEqual(["https://www.getweave.com/"]);
  });

  it("never requests a redirect hop to a private literal address", async () => {
    const { fetchImpl, asked } = redirectingFetch({ "https://www.getweave.com/": "http://127.0.0.1/admin" });

    expect(await fetchPage("https://www.getweave.com/", { fetchImpl, resolveHost: fakeResolve().resolveHost })).toBeNull();
    expect(asked).toEqual(["https://www.getweave.com/"]);
  });

  it("follows a public redirect chain of up to three hops, relative ones included", async () => {
    const { fetchImpl, asked } = redirectingFetch({
      "http://getweave.com/": "https://getweave.com/",
      "https://getweave.com/": "https://www.getweave.com/",
      "https://www.getweave.com/": "/pricing",
    });

    const page = await fetchPage("http://getweave.com/", { fetchImpl, resolveHost: fakeResolve().resolveHost });

    expect(page?.url).toBe("https://www.getweave.com/pricing");
    expect(page?.title).toBe("Weave & Co | Pricing");
    expect(asked).toEqual(["http://getweave.com/", "https://getweave.com/", "https://www.getweave.com/", "https://www.getweave.com/pricing"]);
  });

  it("gives up after three redirects without requesting the fourth target", async () => {
    const { fetchImpl, asked } = redirectingFetch({
      "https://a.example.com/": "https://b.example.com/",
      "https://b.example.com/": "https://c.example.com/",
      "https://c.example.com/": "https://d.example.com/",
      "https://d.example.com/": "https://e.example.com/",
    });

    expect(await fetchPage("https://a.example.com/", { fetchImpl, resolveHost: fakeResolve().resolveHost })).toBeNull();
    expect(asked).toEqual(["https://a.example.com/", "https://b.example.com/", "https://c.example.com/", "https://d.example.com/"]);
  });

  it("drops an error page, a file that isn't HTML and a page over the size cap", async () => {
    const { resolveHost } = fakeResolve();
    expect(await fetchPage("https://getweave.com/", { fetchImpl: fakeFetch("gone", { status: 404 }).fetchImpl, resolveHost })).toBeNull();
    expect(await fetchPage("https://getweave.com/a.pdf", { fetchImpl: fakeFetch("%PDF", { contentType: "application/pdf" }).fetchImpl, resolveHost })).toBeNull();
    expect(await fetchPage("https://getweave.com/", { fetchImpl: fakeFetch(PRICING_HTML).fetchImpl, resolveHost, maxBytes: 50 })).toBeNull();
  });

  it("returns nothing when the request fails", async () => {
    const failing: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };

    expect(await fetchPage("https://getweave.com/", { fetchImpl: failing, resolveHost: fakeResolve().resolveHost })).toBeNull();
  });

  it("cuts long pages to the character cap", async () => {
    const page = await fetchPage("https://getweave.com/", { fetchImpl: fakeFetch(PRICING_HTML).fetchImpl, resolveHost: fakeResolve().resolveHost, maxChars: 20 });

    expect(page?.text).toBe("Phones and texting f");
  });
});
