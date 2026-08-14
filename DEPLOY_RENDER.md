# Deploy Ludo 3D Online on Render

This build is ready for a single Render Web Service.

## Before deploying

Put **all files in this folder at the root of one GitHub repository**.
Do not upload only the `client` folder because the Node/Socket.IO server is required.

## Option A — Render Blueprint (recommended)

1. Create a GitHub repository and push this folder to the repository root.
2. Sign in to Render and choose **New > Blueprint**.
3. Connect the GitHub repository.
4. Render will detect `render.yaml`.
5. Confirm the service and deploy.
6. When the deploy is green, open the generated `https://<service>.onrender.com` URL.
7. Verify `https://<service>.onrender.com/health` returns JSON with `"ok": true`.
8. Create a room and open the room link from another phone/network.

## Option B — Create a Web Service manually

Use these values:

- Runtime: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Instance Type: `Free`
- Health Check Path: `/health`
- Environment Variable: `NODE_ENV=production`

The app already listens on `process.env.PORT` and `0.0.0.0`, which is required by Render.

## Online acceptance test

After deploy:

1. Open the public URL on device A.
2. Create a room.
3. Copy the room link.
4. Open it on device B using another browser or mobile data.
5. Confirm both players appear in realtime.
6. Start/fill with bots and roll once from A.
7. Confirm the same result/state appears on B.
8. Refresh B and confirm reconnect restores the same player.
9. Open `/health` and confirm the room/player counts are sensible.

## Important limitation of the current MVP

Rooms and matches are intentionally stored in the Node.js process memory. A Render restart, redeploy, or instance replacement therefore clears active rooms. This is acceptable for the current hobby/MVP build. A later persistence phase can move transient room/session state to Redis/Render Key Value or another shared store.

On Render Free, an idle web service can spin down. The first visitor after an idle period can therefore wait while it wakes up.
