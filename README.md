# 🎲 Ludo 3D Multiplayer

A modern, real-time **3D multiplayer Ludo game** built for the web with an interactive 3D board, multiplayer rooms, bots, reconnect support, server-authoritative game logic, sound effects, and responsive mobile/desktop gameplay.

<p align="center">
  <strong>Developed by Eng. Abuzaid Saad</strong>
</p>

---

## 🌐 Live Demo

### 👉 [Play Ludo 3D Online](https://gp-9vrs.onrender.com)

> The project is currently hosted on a free Render instance, so the first load may take a few seconds if the server has been inactive.

---

## ✨ Features

### 🎮 Multiplayer Gameplay

* Real-time multiplayer using **Socket.IO**
* Up to **4 players per room**
* Create private game rooms
* Join using a Room Code
* Copy Room Code
* Copy Room Link
* Mobile Share button
* Real-time player synchronization
* Automatic game start when 4 players join

### 🤖 Bots

If a room does not fill with four human players, the room owner can complete the remaining slots with bots.

Supported combinations include:

* 1 Human + 3 Bots
* 2 Humans + 2 Bots
* 3 Humans + 1 Bot
* 4 Humans

Bots use the same server-side game rules as human players.

---

## 🎲 3D Gameplay

The game uses a fully interactive **3D Ludo board** powered by Three.js.

Features include:

* Interactive 3D dice
* Animated dice rolling
* Animated piece movement
* Different camera perspective for each player
* Automatic camera rotation based on player color
* Manual camera control
* Mobile-friendly 3D interaction
* Click/tap the 3D dice to roll on mobile
* Active player piece outlines
* Multiple pieces displayed clearly when occupying the same cell

---

## 📱 Responsive Design

Ludo 3D is designed to work across:

* Desktop
* Laptop
* Tablet
* Mobile

The UI automatically changes depending on the screen size.

On mobile, unnecessary control panels are removed to provide more room for the 3D board.

---

## 🏠 Lobby System

Each multiplayer room includes a modern lobby with:

* Room Code
* Copy Code button
* Copy Room Link button
* Native Share button on supported devices
* Player slots
* Player count
* Room owner indicator
* Bot indicators
* Waiting timer
* Fill With Bots option

Rooms support a maximum of:

```text
4 Players
```

---

## ⏳ Waiting System

When a room is created, a waiting timer starts.

If four human players join, the game begins automatically.

If the timer finishes before the room is full, the room owner can fill the remaining positions with bots.

---

# 🎯 Game Rules

## Leaving the Base

A piece can only leave its base when the player rolls:

```text
6
```

Rolling a 6 also grants an additional roll.

---

## Triple Six Rule

If a player rolls three consecutive sixes:

```text
6 → 6 → 6
```

The third roll is cancelled and the player's turn ends.

---

## Piece Movement

After leaving the base, pieces move forward according to the dice result.

All movement is calculated by the server.

The client cannot manually determine a piece's final position.

---

## ⚔️ Capturing

If a piece lands on an opponent's piece on a normal square:

* The opponent's piece returns to its base.
* The player receives an additional roll.

---

## ⭐ Safe Cells

Certain cells are protected.

Pieces standing on Safe Cells cannot be captured.

Safe cells are displayed using golden stars where appropriate.

Starting cells are also protected but do not display unnecessary visual stars.

---

## 🛡️ Double Piece Protection

If two pieces belonging to the same player occupy the same cell:

```text
Double Block
```

An opponent cannot finish their movement on that cell.

---

## 🏁 Home Lane

After completing a full lap around the board, a piece enters the Home Lane belonging to its color.

A piece must receive the **exact dice value** required to reach the final Home position.

For example:

```text
1 step remaining + Dice = 1 ✅

1 step remaining + Dice = 3 ❌
```

---

## 🎁 Home Reward

When a piece successfully reaches Home:

```text
Player receives an additional roll
```

---

## 🏆 Winning System

Each player has four pieces.

A player receives their final ranking once all four pieces reach Home.

The ranking system is:

```text
🥇 1st Place
🥈 2nd Place
🥉 3rd Place
4th Place
```

The game does **not** wait for the final player to finish.

Once three players have completed all their pieces, the remaining player automatically receives 4th place.

---

# 🔊 Sound System

The game contains contextual audio effects triggered by gameplay events.

Current custom sounds include:

* Rolling a 6
* Piece leaving the base
* Capturing another player
* Piece reaching Home
* Player disconnecting

Additional game sounds are generated or handled by the client audio system.

---

# 🔌 Reconnect System

Players receive a persistent player token stored locally.

If a player disconnects during a game:

```text
Human Player → Temporary Bot
```

The bot continues playing so the game does not stop.

If the original player reconnects using the same session:

```text
Bot → Human Player
```

The player automatically restores:

* Their color
* Their pieces
* Their current progress
* Their position in the game

---

# 🔄 State Synchronization

The server is the authoritative source of truth.

The multiplayer architecture includes:

* `stateVersion`
* `turnId`
* Unique `actionId`
* Duplicate-action protection
* Stale-action protection
* Room action queues
* Full-state snapshots
* Automatic client resynchronization

This prevents issues such as:

* Double dice rolls
* Duplicate piece movement
* Old moves executing after a turn changes
* Different game states between players

---

# 🛡️ Server-Authoritative Architecture

Important game decisions are never trusted to the browser.

The server controls:

* Dice results
* Player turns
* Legal moves
* Piece positions
* Captures
* Safe cells
* Home movement
* Triple six detection
* Extra rolls
* Rankings
* Bot decisions

The browser is mainly responsible for:

```text
Input + 3D Rendering + Animation + Audio
```

---

# 🛠️ Technology Stack

## Frontend

* HTML5
* CSS3
* JavaScript
* Three.js
* Web Audio API

## Backend

* Node.js
* Express.js
* Socket.IO

## Multiplayer

* WebSockets
* Socket.IO Rooms

## Deployment

* Render

---

# 📂 Project Structure

```text
/
├── client/
│   ├── assets/
│   │   ├── audio/
│   │   └── ludo_board_games.glb
│   │
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── server/
│   ├── game/
│   │   └── GameEngine.js
│   │
│   ├── rooms/
│   │   └── RoomManager.js
│   │
│   ├── bots/
│   │   └── BotPlayer.js
│   │
│   └── socket/
│       └── socketHandlers.js
│
├── server.js
├── package.json
├── Dockerfile
└── README.md
```

---

# 🚀 Running Locally

## 1. Clone the repository

```bash
git clone https://github.com/Buzaition/ludo-3d-multiplayer
```

## 2. Open the project

```bash
cd ludo-3d-multiplayer
```

## 3. Install dependencies

```bash
npm install
```

## 4. Start the server

```bash
npm start
```

## 5. Open the game

```text
http://localhost:3000
```

---

# ❤️ Health Check

The backend exposes a health endpoint:

```text
/health
```

Example:

```text
https://gp-9vrs.onrender.com/health
```

The endpoint reports whether the server is online and provides basic room/player statistics.

---

# 🧪 Testing

The project includes automated tests for important game and multiplayer behavior, including:

* Room creation
* Room joining
* Maximum player limit
* Dice rules
* Triple six
* Safe cells
* Capturing
* Double-piece protection
* Exact Home entry
* Home reward
* Rankings
* Bots
* Duplicate actions
* Stale actions
* State synchronization
* Disconnect/reconnect behavior

---

# 🧠 Current Architecture

The current version intentionally uses a lightweight architecture suitable for small multiplayer matches.

Room and game state are currently stored in server memory.

This keeps the project:

* Fast
* Simple
* Easy to deploy
* Suitable for small groups of players

Future versions can introduce Redis or another persistent storage system if horizontal scaling or persistent games are required.

---

# 🗺️ Future Improvements

Potential future additions include:

* Player accounts
* Friends system
* Public matchmaking
* Private invitations
* Game history
* Statistics
* Leaderboards
* Custom player avatars
* More sound effects
* Additional bot difficulty levels
* Redis-backed room persistence
* Multiple server instances
* Spectator mode
* In-game reactions
* Custom themes and boards

---

# 🎨 3D Asset Credits

The Ludo board is based on the **“LUDO Board Games”** 3D model by **prashantraj264 / Prashant Kumar Raj** from Sketchfab.

The model has been integrated and adapted for interactive real-time gameplay.

Original model:

https://sketchfab.com/3d-models/ludo-board-games-7da189e14bef49adbe0bf6020a64b5e8

Please refer to the original asset page for its licensing and attribution requirements.

---

# 👨‍💻 Developer

## Eng. Abuzaid Saad

Designed and developed with a focus on:

* Multiplayer architecture
* Real-time synchronization
* 3D web development
* Responsive gameplay
* Server-authoritative game logic

---

<p align="center">
  <strong>🎲 Ludo 3D Multiplayer</strong>
</p>

<p align="center">
  Developed with ❤️ by <strong>Eng. Abuzaid Saad</strong>
</p>

<p align="center">
  <a href="https://gp-9vrs.onrender.com">Play Now</a>
</p>
