# Developer Guide

For everyone working on Nihon-Go! — whether you knew the old app or you're starting today.

The app moved from **Create React App + Express + MongoDB** to **Next.js on Vercel + Better Auth + Postgres + Airtable**. If you learned the old codebase, most of your knowledge still applies: the components, the exercises, the lesson logic are all the same code. What changed is where things *run* and where data *comes from*.

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

**Create React App is dead.** No longer maintained, and it pinned us to TypeScript 4.9. The deploy path was also broken — `npm run build` *moved* files into a `docs/` folder that isn't even in the repo.

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
// src/app/(player)/newlesson/[slug]/page.tsx  — server
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lesson = await getNewLessonBySlug(slug);   // runs on the server
  if (!lesson) redirect("/dashboard");
  return <NewLessonPlayer slug={slug} lesson={lesson} />;
}
```

```tsx
// src/pages-client/NewLessonPlayer.tsx  — client
"use client";
const NewLessonPlayer = ({ slug, lesson }) => { /* hooks, state, JSX */ };
```

**Why bother?** The lesson data is fetched on the server, so there's no loading spinner, no API round trip from the browser, and the Airtable key never leaves the server. That's why most `useEffect(() => { fetch(...) })` patterns disappeared in the migration — the fetch moved up into the server component.

---

## 3. Old → new, feature by feature

### Routing

| Old (react-router) | New (App Router) |
|---|---|
| `<Route path="/watch">` in `App.tsx` | A folder: `src/app/(site)/(protected)/watch/page.tsx` |
| `useNavigate()` → `navigate("/x")` | `useRouter()` from `next/navigation` → `router.push("/x")` |
| `navigate(-1)` | `router.back()` |
| `useParams()` | `useParams()` from `next/navigation`, or a prop from the server page |
| `useLocation().pathname` | `usePathname()` |
| `<Link to="/x">` | `<Link href="/x">` from `next/link` |
| `location.state.from` | `useSearchParams().get("from")` |

**Route groups** are the new idea. A folder in `(parens)` doesn't appear in the URL — it exists to attach a layout or a guard:

```
(site)/(protected)/watch/page.tsx   →   /watch
```

That URL is just `/watch`. `(site)` gives it the Header and Footer; `(protected)` makes it require a session. This replaces the old `<RequireAuth>` wrapper *and* the `hideHeader`/`hideFooter` pathname string-matching in `App.tsx`.

The four groups:

| Group | Chrome | Access |
|---|---|---|
| `(site)` | Header + Footer | public |
| `(site)/(public-only)` | Header + Footer | **signed-out only** — signed-in users go to `/new-lessons` |
| `(site)/(protected)` | Header + Footer | **signed-in only** |
| `(dashboard)` | Header only | signed-in only |
| `(player)` | none | signed-in only |

### Auth

| Old | New |
|---|---|
| JWT in `localStorage` | httpOnly cookie — **not readable from JS** |
| Axios interceptor attaching `Authorization` | Nothing. Same-origin fetch sends the cookie |
| `isAuthed()` (checks a string exists) | `useSession()` in client code; `getSession()` on the server |
| `<RequireAuth>` wrapper (UI-only) | `(protected)` route group — enforced **server-side** |
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
| `GET /api/lessons` | `listLessons()` from `lib/airtable/content` (server-only) |
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

Config lives in [`src/lib/auth.ts`](src/lib/auth.ts). Sessions are 7-day httpOnly cookies with a 5-minute cache, so a page render usually costs no database read.

**Enforcement is two-layer, and the distinction matters:**

1. `src/middleware.ts` — runs at the edge, only checks that a session cookie *exists*. Fast, but it does **not** validate. It's there to bounce logged-out visitors early.
2. Layouts and route handlers call `getSession()`, which actually verifies. **This is the real boundary.** Never rely on the middleware alone.

**Passwords:** new ones use scrypt. Accounts migrated from MongoDB kept their bcrypt hashes, and `auth.ts` branches on the `$2` prefix to verify either. Migrated users sign in with their existing password and silently upgrade to scrypt when they next change it.

**Password reset** is now a tokened email flow: `/forgot-password` collects an email and sends a link; `/reset-password` takes the token and sets the password. It deliberately gives the same response whether or not the address is registered, so it can't be used to discover who has an account.

### Lesson content (Airtable)

Authors edit the **Cornerstone Content** base. Four tables — `Lessons`, `NewLessons`, `Resources`, `Achievements` — where filterable metadata (slug, prefecture, active) are real fields and lesson bodies are JSON in long-text fields.

**Why JSON in a text field?** The grammar lessons' `items[]` are heterogeneous, deeply nested and order-sensitive. Modelling that as linked records would mean a table per exercise type and a brittle adapter. A JSON field in Airtable's expanded record view is the same authoring experience Compass gave, with a better UI — and it keeps the intentionally-schemaless shape intact.

Reads go through [`lib/airtable/client.ts`](src/lib/airtable/client.ts), which uses plain `fetch` — **not** the `airtable` npm package, which bypasses Next's data cache. Responses are cached 5 minutes and tagged, so Airtable sees roughly one request per table per window rather than one per visitor. That's what keeps us under its 5 req/sec limit.

**Edits go live in seconds**, not five minutes: an Airtable automation POSTs to `/api/revalidate` with the table name, which drops the matching cache tag.

Adapters in [`lib/airtable/adapters.ts`](src/lib/airtable/adapters.ts) turn records into the exact TS shapes the players expect. They **fail soft** — a record with malformed JSON is logged and skipped, never thrown, so one bad edit can't take down a listing.

### Progress

`user_progress` in Postgres, one row per (user, lesson), enforced by a unique index. Writes go through `POST /api/progress`, which **always takes the user id from the session**, never the request body.

The interesting part is **`stepKey`**. The grammar player re-shuffles its exercises on every visit, so saving "the user was on step 7" would resume them at a different exercise next time. Instead we save a content-derived key like `matchAudioExercise:Ohayou gozaimasu`, and on load find that exercise wherever it landed in the new order. `lastStep` is the fallback when the key isn't found.

Treat `stepKey` as opaque: it's generated by `stepKeyForItem()` in the player and never parsed server-side.

### Pronunciation scoring

The pipeline — ffmpeg decode → wav2vec2 phoneme recognition → alignment → score — lives in [`services/pronunciation/`](services/pronunciation/) as its own container. It **cannot** run on Vercel: ~300MB of model weights plus native onnxruntime and ffmpeg binaries exceed the function bundle limit, and it needs to stay warm.

Flow: browser → `POST /api/pronunciation/check` (checks the session) → forwards to the container with a shared secret → returns a phoneme-level diff and a 0–1 score. The browser never talks to the container, and the secret never reaches the client.

The Docker image bakes the model in at build time so cold starts don't re-download it. Run it locally with `npm run build && PRONUNCIATION_SERVICE_SECRET=... npm start` inside that folder.

---

## 5. Common tasks

**Add a page.** Create `src/app/(site)/(protected)/thing/page.tsx`. Pick the group by what the page needs: chrome and access. If it needs data, fetch it in that file and pass it to a `"use client"` component in `src/pages-client/`.

**Add an API endpoint.** `src/app/api/thing/route.ts`, exporting `GET`/`POST`. Start every authenticated handler with:

```ts
const session = await getSession();
if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
```

**Change the database schema.** Edit `src/lib/db/schema.ts`, then `npm run db:generate` (writes SQL to `drizzle/`) and `npm run db:migrate`. Commit the generated SQL.

**Add a lesson.** In Airtable, not in code. Add a row to `Lessons` or `NewLessons`; the `Items`/`Exercises` fields take JSON. It appears within 5 minutes, or instantly if the revalidate automation is wired up.

**Change lesson rendering.** `src/components/` — the exercise components are unchanged from the old app. `renderItem()` in `NewLessonPlayer.tsx` maps an item's `type` to a component.

**Check you didn't break routing.** `npm run parity` — verifies every route's guard and chrome against the original app's route table, in both auth states.

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

**`npm install` from the repo root.** Running it inside `client/` or `server/` pollutes the old apps' dependencies.

---

## 7. Learning resources

**Start here if App Router is new to you** — an hour well spent:

- [Next.js Learn course](https://nextjs.org/learn) — free, interactive, official
- [Server vs Client Components](https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns) — the concept in §2
- [Route groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups) — the `(parens)` folders
- [Route handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) — API endpoints
- [Caching & revalidation](https://nextjs.org/docs/app/building-your-application/caching) — how the Airtable layer stays fast

**The other pieces:**

- [Better Auth](https://better-auth.com/docs) — start with [Email & Password](https://better-auth.com/docs/authentication/email-password) and [Next.js integration](https://better-auth.com/docs/integrations/next)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview) — [queries](https://orm.drizzle.team/docs/rqb) and [migrations](https://orm.drizzle.team/docs/migrations)
- [Airtable Web API](https://airtable.com/developers/web/api/introduction) — especially [filterByFormula](https://support.airtable.com/docs/formula-field-reference)
- [Vercel deployment](https://vercel.com/docs/frameworks/nextjs)
- [Resend](https://resend.com/docs) — transactional email

**Reference for this repo:** [README.md](README.md) · [MIGRATION_PLAN.md](MIGRATION_PLAN.md) (decisions and rationale) · [CUTOVER.md](CUTOVER.md) · `services/pronunciation/README.md`
