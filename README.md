# Undercover — Party Game

Real-time browser party game in the style of **Undercover** / Spyfall. Hosts spin up a room, share a 6-char code, players join with a nickname — no accounts. Most players get the **Civilian** word; one or two get the **Undercover** word (similar but different). Describe, vote, eliminate. Ships with pop-culture themes: **D&D, League of Legends, LOTR, Harry Potter, Baldur's Gate 3**.

## Stack

- Node.js 20 + Express 4 + Socket.IO 4
- React 18 + Vite (built into `public/`, served by Express)
- In-memory room state (no DB, no addons)

## Local development

```bash
npm install
npm --prefix client install
npm run dev            # runs server on :3001 and Vite dev server on :5173 with proxy
# open http://localhost:5173
```

Or run production-style locally:

```bash
npm install
npm run build          # builds client into public/
npm start              # single process on :3001
# open http://localhost:3001
```

Test with **3 browser windows** (use incognito to avoid session-storage collisions): one host, two players.

## Deploy to Heroku

```bash
git init && git add . && git commit -m "init"
heroku create <appname>
git push heroku main
heroku open
```

No addons, no env vars required. Heroku runs `heroku-postbuild` which builds the client, then `web: node server/index.js` from the `Procfile`.

## Adding a theme

Drop a new file into `themes/` following this schema — it's auto-loaded on boot. Each `pair` is a symmetric two-word array; the server randomly decides per game which word goes to the civilians and which to the undercover, so ordering inside the array doesn't matter:

```json
{
  "id": "star_wars",
  "name": "Star Wars",
  "pairs": [
    ["Luke Skywalker", "Anakin Skywalker"],
    ["Lightsaber", "Blaster"]
  ]
}
```

## Game rules

- 3–20 players per room.
- Host picks a theme and the undercover count (1–3).
- Each round: server picks a fresh word pair; assigns roles secretly; players describe their word in a random speaking order.
- Host clicks **Start Voting**; every alive player casts a secret vote; highest-voted player is eliminated and their role revealed.
- **Civilians win** when all undercovers are eliminated. **Undercovers win** when alive undercovers ≥ alive civilians.
- Ties re-vote among tied players; a second tie skips the elimination.
