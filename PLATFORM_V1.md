# Platform V1 — Matchmaking + Public Rooms + Points Validation

This build expands the original private-room Ludo MVP while keeping the same single Render Web Service architecture.

## New player flows

- **Quick Match — Classic:** players wait in an in-memory FIFO queue. Every 4 waiting humans are moved into a new room and the game starts immediately. 8 waiting users naturally become 2 rooms.
- **Quick Match — 2v2:** same queue behavior, with Red + Yellow on Team A and Green + Blue on Team B. Teammates do not capture each other. The first team whose two players finish all pieces wins.
- **Play vs Computer:** creates a private game immediately with 1 human + 3 server bots.
- **Private rooms:** existing room-code/link flow remains available.
- **Public rooms:** waiting public rooms are discoverable from the home page and can be joined directly.

All active rooms and matchmaking queues remain in memory on the Render server. This is intentional for the current MVP.

## Points Store — validation only

There is no payment gateway and no money is collected. The store records a funnel only:

1. `STORE_VIEW`
2. `PACKAGE_CLICK`
3. `PAYMENT_METHOD_SELECTED`
4. `PURCHASE_INTENT`
5. `PURCHASE_CANCELLED`

Demo packages:

- Starter — 500 Points — 10 EGP
- Popular — 1,200 Points — 20 EGP
- Pro — 3,500 Points — 50 EGP
- King — 8,000 Points — 100 EGP

Payment preference choices:

- Vodafone Cash
- InstaPay

Aggregated results are available at `/admin.html`.

## GitHub JSON analytics persistence

If GitHub variables are not configured, analytics still work in memory but reset whenever Render restarts.

For persistent statistics, use a **separate GitHub repository** such as `ludo-analytics-data`. Using a separate repository is strongly recommended because committing analytics into the same repository connected to Render may trigger unnecessary automatic deployments.

Create a fine-grained GitHub token with **Contents: Read and write** for the analytics-data repository, then add these Render environment variables:

```text
GITHUB_TOKEN=...
GITHUB_OWNER=your-github-user
GITHUB_REPO=ludo-analytics-data
GITHUB_BRANCH=main
GITHUB_DATA_PATH=data/analytics.json
ANALYTICS_FLUSH_MS=45000
```

Alternatively, provide the complete GitHub Contents API endpoint:

```text
GITHUB_ANALYTICS_API_URL=https://api.github.com/repos/OWNER/ludo-analytics-data/contents/data/analytics.json
GITHUB_TOKEN=...
GITHUB_BRANCH=main
```

The server buffers events and writes the JSON periodically instead of creating a GitHub commit for every click.

Optional admin protection:

```text
ADMIN_KEY=choose-a-private-key
```

Then open:

```text
https://YOUR-DOMAIN/admin.html
```

and enter the key in the analytics page.

## Health check

`/health` now also reports:

- number of public rooms
- Classic matchmaking queue size
- 2v2 matchmaking queue size
- analytics persistence mode (`memory` or `github`)
