// =============================================================================
// Module Overview
// =============================================================================
// What every provider adapter shares: `ConnectorError`, whose message is
// written for the owner, and `FetchLike`, so tests hand an adapter a fake
// `fetch` instead of reaching the network.

/** A provider refused or failed a send. `message` is for the owner; `retryable` says whether trying later may work. */
export class ConnectorError extends Error {
  override readonly name = "ConnectorError";

  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** The part of `fetch` the adapters use. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
