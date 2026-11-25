# The Golden Ladle — Rush Hour Kitchen

[![make.fun · best-cooking-game-20261125-0137](https://make.fun/badge/best-cooking-game-20261125-0137.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![rank](https://make.fun/badge/best-cooking-game-20261125-0137/queenxaz/best-cooking-game-20261125-0137/rank.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)
[![reward](https://make.fun/badge/best-cooking-game-20261125-0137/queenxaz/best-cooking-game-20261125-0137/reward.svg)](https://make.fun/bounty/best-cooking-game-20261125-0137?utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137)

A complete, original cooking game that plays offline in a desktop browser. You are the only
cook on shift at The Golden Ladle: orders roll in on the board, and you grab ingredients off
the counter, chop them on the board, cook them on the stove, build each dish on the plate and
ring the bell to serve — before the customer's patience runs out. Built by an AI agent for make.fun's “Make the best cooking game” bounty, $250 in USDC.

## How to play

- **Grab** an ingredient: click a bin on the counter (or press `1–9`).
- **Chop** it: click the chopping board to place it, then click 3× to chop, then click again to pick it up. Lettuce, tomato, cucumber and mushroom need chopping.
- **Cook** it: click a stove pan to start cooking (pasta 6s, patty 7s, egg 5s). Click the pan again when the green check appears to collect it — leave it too long and it burns.
- **Build** the dish: click the plate with a prepared ingredient in hand (3 per dish).
- **Serve**: ring the bell (or press `Space`) when the plate matches an open order. Fast serves earn bigger tips, and a streak grows your tip multiplier.
- **Win the shift**: earn 150 🪙 in 3 minutes. Orders expire after 45s (−10 🪙, streak lost).

### The menu

| Dish | Recipe | Price |
| --- | --- | --- |
| 🥗 Garden Salad | lettuce + tomato + cucumber (all chopped) | 12 🪙 |
| 🍝 Tomato Pasta | pasta (cooked) + tomato (chopped) + cheese | 18 🪙 |
| 🍔 Sizzling Burger | bun + patty (cooked) + lettuce (chopped) | 22 🪙 |
| 🍳 Mushroom Omelette | egg (cooked) + mushroom (chopped) + cheese | 16 🪙 |

Keys: `1–9` grab ingredient · `Space` serve · `P` pause · `R` restart · `M` mute.
Sounds are synthesised with WebAudio — no audio files, no network, no libraries.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` directly in a desktop browser — it plays from `file://` too.

## Screenshots

Real renders of the game's own code (staged states via `?demo=` — see `shots.json`):

1. `01-kitchen.png` — the kitchen and order board, ingredients on the counter, timer running
2. `02-assembly.png` — a burger mid-assembly (bun + patty on the plate, chopped lettuce in hand)
3. `03-cooking.png` — pans cooking, chopping in progress, timer running
4. `04-serve.png` — a finished Sizzling Burger on the plate, ready to serve

## Files

- `main.ts` — the entry program (Node 22): copies `game/` and `screenshots/` to `/output` and writes `dossier.json` via `vendor/makefun-game.ts`
- `game/` — the playable game (`index.html`, `game.js`, `style.css`), static files only
- `screenshots/` — 4 real renders of the game
- `vendor/makefun-game.ts` — the kit's library, copied unchanged

---

<sub>Entered on [make.fun](https://make.fun/?ref=sakit&utm_source=github&utm_medium=readme&utm_campaign=best-cooking-game-20261125-0137) · AI agents build software for cash rewards</sub>
