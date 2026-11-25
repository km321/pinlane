# Pinlane

Open-source visual feedback for agencies and developers.

Clients open a magic review link, pin comments and highlights on the **live site**, and every note becomes a card on your Kanban board. Brand the workspace as your own. Point coding agents at the **MCP server** so they can read tickets and work the linked GitHub repo.

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Drizzle ORM + Postgres
- Better Auth (email/password)
- Embed widget (Vite IIFE → `public/embed.js`)
- MCP over HTTP (`/api/mcp`) + local stdio bridge

## Quick start

```bash
cp .env.example .env
# set DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL

npm install
npm run db:push
npm run build:embed
npm run dev
```

App: [http://127.0.0.1:3456](http://127.0.0.1:3456)

1. **First signup becomes the owner** — that account owns the agency workspace, then public signup locks  
2. Create a project with your staging site URL  
3. Copy the embed snippet onto that site  
4. Create a review invite and send the link to your client  
5. Work feedback on the board  
6. (Optional) Create an API key under **Branding & API keys** for MCP  

Clients never need accounts (magic review links). Extra agency seats are not open-signup; they stay owner-gated for self-host.

## Embed snippet

```html
<script
  src="https://YOUR_HOST/embed.js"
  data-project="pk_…"
  async
></script>
```

The widget stays quiet until a valid `?pinlane=SESSION_TOKEN` (from the review claim flow) is present.

## MCP for agents

Create a workspace API key, then add to Cursor:

```json
{
  "mcpServers": {
    "pinlane": {
      "url": "https://YOUR_HOST/api/mcp",
      "headers": {
        "Authorization": "Bearer pln_…"
      }
    }
  }
}
```

Local stdio bridge:

```bash
PINLANE_URL=http://127.0.0.1:3456 PINLANE_API_KEY=pln_… npm run mcp
```

Tools: `list_projects`, `list_tickets`, `get_ticket`, `update_ticket`, `add_reply`, `get_github_context`.

Pinlane does not store a GitHub PAT. Agents use their own GitHub tools against the repo linked on each project.

## Railway

Production: [https://pinlane-production.up.railway.app](https://pinlane-production.up.railway.app)

1. New project → add **Postgres**  
2. Deploy this repo as a web service (Node **22**; `NIXPACKS_NODE_VERSION=22`)  
3. Set `DATABASE_URL` (from Postgres), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` to the public URL  
4. Start command: `npm run start:migrate` (runs Drizzle migrations, then Next on `$PORT`)  
5. Point the public domain’s **target port** at the same `$PORT` the process listens on (default `8080` on Railway)

First visit: create the owner account on `/signup`. Signup locks after that.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next.js on port 3456 |
| `npm run build:embed` | Build `public/embed.js` |
| `npm run db:push` | Push schema (dev) |
| `npm run db:generate` / `db:migrate` | SQL migrations |
| `npm run db:seed` | Sample project (after signup as `demo@pinlane.dev`) |
| `npm run mcp` | Stdio MCP bridge |

## License

MIT
