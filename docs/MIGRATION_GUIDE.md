# Developer Guide

For everyone working on Nihon-Go! — whether you knew the old app or you're starting today.

The app moved from **Create React App + Express + MongoDB** to **Next.js on Vercel + Better Auth + Payload CMS + Postgres**. If you learned the old codebase, most of your knowledge still applies: the components, the exercises, the lesson logic are all the same code. What changed is where things *run* and where data *comes from*.

> **Status: current.** Despite the filename, this describes the stack that is running. It was written after the migration shipped, so §2 and §4–§7 are live reference. §1 and §3 are *historical by design* — they exist to bridge from the old app, and the "Old" columns describe code that has since been deleted from the repo (#42); it lives on only in git history.
>
> Content briefly lived in Airtable mid-migration and no longer does — it is in Payload, in the same Postgres database as everything else (#20). Old MongoDB accounts were not migrated (#22). Any doc or comment saying otherwise predates those decisions; [MIGRATION_PLAN.md](MIGRATION_PLAN.md) is the superseded record of both.

**Contents**

1. [Why this changed](#1-why-this-changed)
2. [The one big idea: server vs client](#2-the-one-big-idea-server-vs-client)
3. [Old → new, feature by feature](#3-old--new-feature-by-feature)
4. [How each subsystem works now](#4-how-each-subsystem-works-now)
5. [Common tasks](#5-common-tasks)
6. [Gotchas](#6-gotchas)
7. [Learning resources](#7-learning-resources)

---

## 1. Why this changed

Four problems, all fixed by the move:

**Create React App is dead.** No longer maintained, and it pinned us to TypeScript 4.9. The deploy path was also broken — `npm run build` *moved* the build output into `docs/` for GitHub Pages, emptying `client/build/` as a side effect.

**Two servers, two deploys.** A static client on GitHub Pages plus an Express API elsewhere. Now it's one app, one deploy.

**The auth had real holes.** Not theoretical ones:

- `POST /api/auth/reset-password` reset **any account's password given only an email address**. No token, no verification. Anyone who knew your email could take your account.
- `JWT_SECRET` fell back to the literal string `"devsecret"` if the env var was missing — so a misconfigured deploy accepted forged tokens.
- The JWT lived in `localStorage`, readable by any XSS.
- CORS reflected any origin.

**Content could only be edited in MongoDB Compass.** Authors needed a database client and had to hand-edit raw documents.

---

## 2. The one big idea: server vs client

This is the concept everything else depends on. In CRA, *all* your code ran in the browser. In Next.js App Router, a component runs on the **server** by default, and only becomes a browser component when you opt in with `"use client"` at the top of the file.

**Server components** can `await` a database or API call directly. They can read secrets. They never ship to the browser. They can't use `useState`, `useEffect`, or event handlers.

**Client components** are what you already know — hooks, state, `onClick`. They can't touch secrets or the database.

In this codebase the split is deliberately simple:

```
src/app/**/page.tsx     server — fetches data, passes it down as props
src/pages-client/*.tsx  client — the actual page UI ("use client")
src/components/*.tsx    client — all shared UI and exercises
```

So a page is two files. The server one fetches; the client one renders:

```tsx
// src/app/(app)/(player)/newlesson/[slug]/page.tsx  — server
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await getNewLessonBySlug(slug);   // runs on the server
  if (!lesson) redirect("/dashboard");
  return <NewLessonPlayer slug={lesson.slug} lesson={lesson} />;
}
```

```tsx
// src/pages-client/NewLessonPlayer.tsx  — client
"use client";
const NewLessonPlayer = ({ slug, lesson }) => { /* hooks, state, JSX */ };
```

**Why bother?** The lesson data is fetched on the server, so there's no loading spinner, no API round trip from the browser, and the database is never reachable from the client. That's why most `useEffect(() => { fetch(...) })` patterns disappeared in the migration — the fetch moved up into the server component.

---

## 3. Old → new, feature by feature

### Routing

| Old (react-router) | New (App Router) |
|---|---|
| `<Route path="/watch">` in `App.tsx` | A folder: `src/app/(app)/(learn)/watch/page.tsx` |
| `useNavigate()` → `navigate("/x")` | `useRouter()` from `next/navigation` → `router.push("/x")` |
| `navigate(-1)` | `router.back()` |
| `useParams()` | `useParams()` from `next/navigation`, or a prop from the server page |
| `useLocation().pathname` | `usePathname()` |
| `<Link to="/x">` | `<Link href="/x">` from `next/link` |
| `location.state.from` | `useSearchParams().get("from")` |

**Route groups** are the new idea. A folder in `(parens)` doesn't appear in the URL — it exists to attach a layout or a guard:

```
(app)/(learn)/watch/page.tsx   →   /watch
```

That URL is just `/watch`. `(learn)` gives it the Header and Footer and requires a session. This replaces the old `<RequireAuth>` wrapper *and* the `hideHeader`/`hideFooter` pathname string-matching in `App.tsx`.

The outermost pair splits the app from the CMS: everything the site serves lives under `(app)`, and Payload's admin and API live under `(payload)`. Inside `(app)`:

| Group | Chrome | Access |
|---|---|---|
| `(public)` | Header + Footer | public |
| `(learn)` | Header + Footer | signed-in only |
| `(dashboard)` | Header only | signed-in only |
| `(player)` | none | learner session, or a CMS editor previewing |

`/auth` lives in `(public)` and guards itself. A layout is never given `searchParams`, so a signed-in visitor's `from` destination cannot be read in a group layout.

`src/app/(payload)/` is generated by Payload — it serves `/admin` and Payload's REST and GraphQL APIs, and is not meant to be hand-edited.

### Auth

| Old | New |
|---|---|
| JWT in `localStorage` | httpOnly cookie — **not readable from JS** |
| Axios interceptor attaching `Authorization` | Nothing. Same-origin fetch sends the cookie |
| `isAuthed()` (checks a string exists) | `useSession()` in client code; `getSession()` on the server |
| `<RequireAuth>` wrapper (UI-only) | `(learn)` route group — enforced **server-side** |
| `POST /api/auth/login` | `signIn.email({ email, password })` |
| `POST /api/auth/signup` | `signUp.email({ ... })` |
| `GET /api/auth/me` | `useSession()` |
| Full page reload after login | `router.push()` + `router.refresh()` |

The critical difference: the old guard only hid UI. Anyone could open devtools, set a fake `access_token`, and the page would render (the API still refused, but the app *looked* logged in). Now the check happens on the server before any HTML is produced.

```tsx
// client
const { data: session, isPending } = useSession();
const user = session?.user;   // typed, includes firstName/lastName/role

// server
const session = await getSession();      // may be null
const session = await requireSession();  // redirects to /auth if absent
```

### Data

| Old | New |
|---|---|
| `GET /api/lessons` | `listLessons()` from `lib/content/content` (server-only) |
| `GET /api/lessons/:slug` | `getLessonBySlug(slug)` |
| `GET /api/newlessons` | `listNewLessons()` |
| `GET /api/resources` | `getResources()` |
| `POST /api/progress` | Same URL — now a Next route handler backed by Postgres |
| Mongoose models | Drizzle schema in `src/lib/db/schema.ts` |
| `services/api.ts` (axios) | Deleted. Server components fetch directly; `lib/*-client.ts` for browser calls |

The data *shapes* are unchanged. `LessonDoc`, `NewLessonDoc`, `NewLessonItem` in `src/lib/types/lessons.ts` are copied verbatim from the old service files, which is why every exercise component ported without modification.

---

## 4. How each subsystem works now

### Auth (Better Auth + Postgres)

Config lives in [`src/lib/auth.ts`](../src/lib/auth.ts). Sessions are 7-day httpOnly cookies with a 5-minute cache, so a page render usually costs no database read.

**Enforcement is two-layer, and the distinction matters:**

1. `src/proxy.ts` — runs at the edge, only checks that a session cookie *exists*. Fast, but it does **not** validate. It's there to bounce logged-out visitors early. (Next 16 renamed this convention from Middleware to Proxy; if you remember `middleware.ts`, this is that file.)
2. Layouts and route handlers call `getSession()`, which actually verifies. **This is the real boundary.** Never rely on the proxy alone.

**Passwords** use scrypt. There is no legacy-hash path: migrating the old MongoDB user accounts was dropped (#22), so every account in Postgres was created by Better Auth. Anyone from the old app signs up again.

**Password reset** is now a tokened email flow: `/forgot-password` collects an email and sends a link; `/reset-password` takes the token and sets the password. It deliberately gives the same response whether or not the address is registered, so it can't be used to discover who has an account.

### Lesson content (Payload CMS)

Authors edit at **`/admin`**, in the app itself. Payload is not a separate service: it runs inside this Next app and stores everything in the `payload` schema of the same Postgres database, alongside auth and progress in `public`. See [docs/payload-content-model.md](payload-content-model.md) for the collections.

**The two lesson systems became one.** The old `lessons` and `newlessons` collections are a single `lessons` collection with a `format` field that selects the player:

| `format` | URL | Player |
|---|---|---|
| `flashcard` | `/lesson/<slug>` | the prefecture player |
| `step` | `/newlesson/<slug>` | the grammar player, one component per screen |

Exercise bodies are modelled as real Payload **blocks** rather than JSON blobs, so each exercise type is editable as a form instead of hand-written JSON — which is the thing neither Compass nor a long-text field could give.

Reads go through [`src/lib/content/content.ts`](../src/lib/content/content.ts), the only module in the app that talks to Payload. It calls Payload's **local API** — an in-process database query, not HTTP — so there is nothing for Next to cache implicitly and the caching is explicit: every lookup is wrapped in `unstable_cache` and tagged. Reads pass `overrideAccess: false`, so unpublished drafts cannot leak even if a query forgets to filter.

**Edits go live immediately.** There is no webhook, no automation and no shared secret: the collection hooks in [`src/payload/hooks/revalidate.ts`](../src/payload/hooks/revalidate.ts) drop the affected tags in-process on every save and delete, because Payload is running in the same process. A one-hour expiry is the backstop for anything a hook misses.

Adapters in [`src/lib/content/adapters.ts`](../src/lib/content/adapters.ts) turn Payload documents into the exact TS shapes the players expect — the same shapes the Express API returned, which is why the exercise components ported unchanged.

**Admin accounts** are the `cms_admins` collection, entirely separate from learner accounts in `public.user`. Until one exists, Payload offers an unauthenticated first-user form at `/admin`; `npm run payload:seed-admins` closes that.

### Progress

`user_progress` in Postgres, one row per (user, lesson), enforced by a unique index. Writes go through `POST /api/progress`, which **always takes the user id from the session**, never the request body.

The interesting part is **`stepKey`**. The grammar player re-shuffles its exercises on every visit, so saving "the user was on step 7" would resume them at a different exercise next time. Instead we save a content-derived key like `matchAudioExercise:Ohayou gozaimasu`, and on load find that exercise wherever it landed in the new order. `lastStep` is the fallback when the key isn't found.

Treat `stepKey` as opaque: it's generated by `stepKeyForItem()` in the player and never parsed server-side.

### Pronunciation scoring

The pipeline — ffmpeg decode → wav2vec2 phoneme recognition → alignment → score — lives in [`services/pronunciation/`](../services/pronunciation/) as its own container. It **cannot** run on Vercel: ~300MB of model weights plus native onnxruntime and ffmpeg binaries exceed the function bundle limit, and it needs to stay warm.

Flow: browser → `POST /api/pronunciation/check` (checks the session) → forwards to the container with a shared secret → returns a phoneme-level diff and a 0–1 score. The browser never talks to the container, and the secret never reaches the client.

The Docker image bakes the model in at build time so cold starts don't re-download it. Run it locally with `npm run build && PRONUNCIATION_SERVICE_SECRET=... npm start` inside that folder.

---

## 5. Common tasks

**Add a page.** Create `src/app/(app)/(learn)/thing/page.tsx` (or `(public)` / `(dashboard)` / `(player)`, matching chrome and access). If it needs data, fetch it in that file and pass it to a `"use client"` component in `src/pages-client/`.

**Add an API endpoint.** `src/app/(app)/api/thing/route.ts`, exporting `GET`/`POST`. Start every authenticated handler with:

```ts
const session = await getSession();
if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
```

**Change the database schema.** Which system owns it decides the command, and they are not interchangeable:

- `public` (auth, `user_progress`) — edit `src/lib/db/schema.ts`, then `npm run db:generate` and `npm run db:migrate`. Commit the generated SQL.
- `payload` (all content) — edit the collection under `src/payload/`, then `npm run payload:migrate:create` and `npm run payload:migrate`. Never `push: true`; see [docs/payload-content-model.md](payload-content-model.md).

Drizzle always migrates first — Payload never issues `CREATE SCHEMA`.

**Add a lesson.** At `/admin`, not in code. Create a `lessons` document, set its `format` to pick the player, and build the exercises as blocks. Saving it publishes immediately.

**Change lesson rendering.** `src/components/` — the exercise components are unchanged from the old app. `renderItem()` in `NewLessonPlayer.tsx` maps an item's `type` to a component.

**Check you didn't break anything.** `npm run typecheck`, then `npm run parity` — it verifies every route's guard and chrome against the original app's route table in both auth states, then that the CMS is up and actually serving content. There is no test suite; these two are the check.

---

## 6. Gotchas

**`"use client"` is required for anything interactive.** Hooks, `onClick`, browser APIs. The error message when you forget is clear, but the fix isn't always: don't slap it on a page that fetches data — split it into a server page plus a client component.

**Never compute random or time-varying values during render.** The server renders once and the browser hydrates; if the two disagree, React throws a hydration error. This bit us for real: the grammar player shuffled its exercises during render. The fix is to do it in `useEffect`, so it happens once, in the browser:

```tsx
// wrong — different order on server and client
const items = useMemo(() => expandLessonItems(lesson.items), [lesson]);

// right
const [items, setItems] = useState<NewLessonItem[] | null>(null);
useEffect(() => { setItems(expandLessonItems(lesson.items ?? [])); }, [lesson]);
```

**`params` is a Promise.** In Next 15+, `await params` in server components.

**Secrets are server-only.** Anything in a `"use client"` file is public. Server-only modules import `"server-only"` to make a mistake a build error instead of a leak.

**MUI must be inside client components.** A server component may not render `sx` props. That's why every page body is a client component.

**Don't bump MUI past 6** during this transition — v7+ changes the Grid API. Next 16 works with MUI 6 via `@mui/material-nextjs@9`, which has no `@mui/material` peer dependency.

**Emotion/SSR problems only appear in production builds.** If styles look wrong, test with `npm run build && npm start`, not `npm run dev`.

**`npm install` from the repo root.** There is only one `package.json` now — the old `client/` and `server/` ones went with those trees (#42).

---

## 7. Learning resources

**Start here if App Router is new to you** — an hour well spent:

- [Next.js Learn course](https://nextjs.org/learn) — free, interactive, official
- [Server vs Client Components](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns) — the concept in §2
- [Route groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups) — the `(parens)` folders
- [Route handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — API endpoints
- [Caching & revalidation](https://nextjs.org/docs/app/building-your-application/caching) — the tags in `lib/content/content.ts`
- [Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — Next 16's rename of Middleware, which is `src/proxy.ts`

Next also ships its own version-exact docs at `node_modules/next/dist/docs/`. Prefer them over anything you remember about Next: this version has breaking changes, and that folder is what matches the installed release.

**The other pieces:**

- [Better Auth](https://better-auth.com/docs) — start with [Email & Password](https://better-auth.com/docs/authentication/email-password) and [Next.js integration](https://better-auth.com/docs/integrations/next)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview) — [queries](https://orm.drizzle.team/docs/rqb) and [migrations](https://orm.drizzle.team/docs/migrations)
- [Payload](https://payloadcms.com/docs) — start with [collections](https://payloadcms.com/docs/configuration/collections) and [blocks](https://payloadcms.com/docs/fields/blocks). We are pinned to **3.x**; don't follow v4 docs
- [Neon](https://neon.com/docs) — branches are how every developer gets a database
- [Vercel deployment](https://vercel.com/docs/frameworks/nextjs)
- [Resend](https://resend.com/docs) — transactional email

**Reference for this repo:** [README.md](../README.md) · [AGENTS.md](../AGENTS.md) · [docs/database-workflow.md](database-workflow.md) · [docs/payload-content-model.md](payload-content-model.md) · [MIGRATION_PLAN.md](MIGRATION_PLAN.md) (decisions and rationale) · [CUTOVER.md](CUTOVER.md) · `services/pronunciation/README.md`
