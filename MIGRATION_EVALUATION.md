# Build Tooling Migration — Evaluation (OPEN)

## Prerequisite open question (decide this FIRST)

**Is this app worth maintaining/modernizing at all?**

Context: this is most likely an early first project from years ago. Before any
tooling work, I want to really understand **what actually exists content- and
feature-wise**, and judge whether that substance is worth preserving — or whether
taking it on (and the risk of breaking it) outweighs what's there.

What to assess when we pick this up:
- How much **real content** exists (lessons, characters, cultural facts, stories) vs placeholder.
- Which **features/pages are actually wired and working** vs stubs.
- Whether the **exercise components** (drag-drop, audio match, dot match, flips) are functional or skeletal.
- How much **backend data/modeling + seed data** is real.
- Overall: is there enough here to justify maintaining, or is a clean rebuild lower-risk?

No answer yet. The migration question below is **downstream** of this — only relevant if we decide the app is worth keeping.

---

Status: **To revisit / evaluate.** No decision made yet.
Question: Migrate the client off Create React App to **Vite** (latest), or go further to **Next.js**?

This note captures the analysis so far so we can pick it back up with context.

---

## Decisive architecture facts

These constraints drive the whole decision:

- **Frontend is a static SPA.** CRA (`react-scripts` 5.0.1); build deploys via `mv build/* ../docs` → GitHub Pages (static hosting).
- **Backend is a separate, already-secured API.** Express + MongoDB, JWT auth enforced server-side in `server/src/middleware/requireAuth.ts`; bcrypt + login/signup/me/changePassword in `server/src/controllers/authController.ts`.
- **Auth model today:** JWT returned as JSON, stored in `localStorage` (`access_token`), sent as `Authorization: Bearer` (`client/src/services/api.ts`). `RequireAuth` in `client/src/App.tsx` is cosmetic (UI gating only); real enforcement is the Express middleware.
- **Heavy client-only UI:** MUI + Emotion, Framer Motion, D3 map. All client-rendered.
- **No SSR/SEO need today:** core app is behind login; only ~6 public content pages (`/`, `/funfacts`, `/resources`, `/gallery`, `/stories`, `/characters/:id`).

## Key insight

The **frontend build tool is not the security boundary** — the Express API is. Swapping CRA → Vite (or Next) changes nothing about enforcement.

The one real frontend security weakness is **JWT in `localStorage` (XSS-exposed)**. That is fixable **without Next**: have Express set an `httpOnly; Secure; SameSite` cookie and switch `api.ts` to `withCredentials: true`. Next.js only *uniquely* adds **server-side route gating**, which isn't our actual security boundary.

## Options & cost

| Option | Cost | Keeps |
|---|---|---|
| **Vite** (recommended lean) | Hours; reversible. Change build tooling, `index.html` entry, `REACT_APP_*` → `VITE_*` / `import.meta.env`. | react-router, JWT/Express, GitHub Pages, MUI/D3/Framer as-is |
| **Vite + httpOnly cookie auth** | Vite cost + small backend auth change | Same architecture; captures the real security win |
| **Next.js (cookie + SSR auth)** | Large: move OFF GitHub Pages to a Node host; fork or absorb the Express backend; rewrite auth (cookies, delete token layer, middleware gating); migrate routing to file-based; pay MUI/Emotion SSR setup tax | Little of the current setup untouched |

## "Is Next worth it?" — checklist to evaluate on revisit

Lean Next **only if several of these become true**:

- [ ] We need real SEO / link previews on public content pages (and SSG via a Vite prerender plugin isn't enough).
- [ ] We want to consolidate to one repo/runtime and retire the standalone Express server.
- [ ] We're willing to leave GitHub Pages for Vercel/Node (incl. cost + deploy pipeline).
- [ ] We want server-side route gating + cookie/SSR auth as a first-class requirement.
- [ ] We're okay paying the MUI App-Router SSR integration tax.

If most stay unchecked, **Vite is the right call.**

## Tentative recommendation

1. Migrate CRA → **Vite** (solves the actual pain: dead/slow CRA, Webpack lock-in, TS pinned to 4.9).
2. Separately, **move JWT from `localStorage` to an httpOnly cookie** for the real security win.
3. Keep **Next.js as a deliberate future option**, revisited against the checklist above.
