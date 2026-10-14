# Architecture

## Goals

- Fast: every tap writes to the device first. The screen never waits for the network.
- Private: the server stores only encrypted events.
- Zero cost and zero daily maintenance: Cloudflare free plan, no servers to patch.

## Data flow

1. The app makes an event, for example `expense` or `payment`.
2. The app adds the event to the local store (IndexedDB) and recomputes balances.
3. The app seals the event with the group key (AES-GCM, key from HKDF) and puts it in a send queue.
4. The queue sends sealed events to `POST /api/g/:gid/events`. The group's Durable Object stores them with a sequence number.
5. The Durable Object sends new events to all open WebSockets of the group. Other devices open them with the key and recompute.

## Events

Events are append-only. The current state is a fold of all events, sorted by time and then by id, so every device gets the same result. An edit is a new `expense` event with the same `eid`. A delete is an `expense.del` event.

## Access

The first device that writes to a group sets the hash of an access token. The token comes from the group key, so only devices with the invite link can read or write. The server never sees the key.

## Rates

`GET /api/rates` returns the ECB daily reference rates. The Worker caches them for 6 hours. The app keeps the last rates for offline use.
