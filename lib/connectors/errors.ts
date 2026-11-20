// =============================================================================
// Module Overview
// =============================================================================
// What every provider adapter shares: `ConnectorError`, whose message is
// written for the owner, `PROVIDER_TIMEOUT_MS`, and `FetchLike`, so tests hand
// an adapter a fake `fetch` instead of reaching the network.

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

/**
 * How long an adapter waits for a provider. A send that hangs past this fails and is settled, instead of
 * leaving its outbox entry in `sending` when the server function is stopped.
 */
export const PROVIDER_TIMEOUT_MS = 15_000;

/** The part of `fetch` the adapters use. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;
