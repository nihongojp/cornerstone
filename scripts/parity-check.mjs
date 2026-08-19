/**
 * P5 parity check — every CRA route, in both auth states, against the Next app.
 *
 *   node scripts/parity-check.mjs [baseUrl]
 *
 * The expectations below are transcribed from client/src/App.tsx: the route
 * table, the RequireAuth/PublicOnly wrappers, and the hideHeader/hideFooter
 * rules. This exists so parity is re-checkable after any change, rather than
 * being a one-off click-through.
 *
 * ── The signed-in half needs an account ─────────────────────────────────────
 *
 * It used to be a hardcoded `hanako@example.com`, left over from the migrated
 * MongoDB users. Legacy user migration was dropped (#22), so that account does
 * not exist in a fresh environment and the signed-in half failed everywhere
 * except the one machine where somebody had created it by hand (#28).
 *
 * So the check brings its own, and how it does that changed with passwordless
 * sign-in (#62). Password signup is closed and password sign-in is not offered,
 * so there is no password to hand this script — PARITY_EMAIL / PARITY_PASSWORD
 * are gone rather than merely unused.
 *
 * It now signs in the way a person does, with a one-time code. The code cannot
 * be read out of the database (`storeOTP: "hashed"`), and this script has no
 * mailbox, so `sendVerificationOTP` writes it to a file instead of mailing it —
 * but *only* for addresses ending in `@parity-check.invalid`. `.invalid` is
 * reserved by RFC 2606 and can never resolve, so that branch cannot fire for a
 * real person. See `src/lib/auth-fixture-sink.ts`.
 *
 * The consequence worth knowing: the file lands on the server's filesystem, so
 * this works against a server on the same host — localhost — and not against a
 * remote preview or production URL. That is a real loss of reach compared with
 * the password fixture, and the honest trade for not keeping a working sign-in
 * credential in a table that every Neon branch copies.
 *
 * ── The CMS is checked separately ───────────────────────────────────────────
 *
 * The route table below only asks whether each URL renders. That is silent
 * about the half of the stack the pivot introduced: a deployment with an empty
 * database, or with a wide-open admin bootstrap, renders all 36 routes exactly
 * as a good one does. The CMS section (see CMS, further down) covers that, and
 * prints its own count so the 36 stays comparable with earlier runs.
 *
 * ── Getting past Vercel's auth wall ─────────────────────────────────────────
 *
 * Vercel Authentication at the Standard Protection scope (#32) covers every
 * preview URL and the `*.vercel.app` production one. Against those, a run with
 * no credentials never reaches the app at all: Vercel answers 401 before Next
 * sees the request, so all 36 routes fail identically and the report reads as
 * "this deployment is broken" when it means "the checker could not get in".
 *
 * So every request carries `x-vercel-protection-bypass` when
 * VERCEL_AUTOMATION_BYPASS_SECRET is set, and none of them carry it when it is
 * not — an empty header would be a credential that fails rather than an absent
 * one. Nothing changes for the two targets that were never walled: localhost,
 * and the custom production domain, which Standard Protection deliberately
 * leaves public.
 *
 * The secret lives in `.env.local` because that is where #32's wizard writes
 * it, and this script reads process.env rather than loading any env file. The
 * npm script bridges that with `--env-file-if-exists`, so `npm run parity`
 * picks the secret up without anyone having to re-export it by hand. Running
 * `node scripts/parity-check.mjs` directly skips that bridge — export the
 * variable yourself, or go through npm. A shell variable still wins over the
 * file, which is what makes a one-off override work.
 */

import { readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const BASE = process.argv[2] || "http://localhost:3000";

/*
 * Empty counts as absent: a wizard that wrote the key but not the value leaves
 * `VERCEL_AUTOMATION_BYPASS_SECRET=` in .env.local, and sending that header
 * empty would earn the same 401 as sending nothing while looking like it had
 * been configured.
 */
const BYPASS_SECRET = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";

/**
 * Headers for one request. Every fetch in this file goes through here, so the
 * bypass cannot be on some requests and missing from others — a half-walled run
 * is harder to read than a fully walled one.
 */
function headers(extra = {}) {
  const base = { ...extra };
  if (BYPASS_SECRET) base["x-vercel-protection-bypass"] = BYPASS_SECRET;
  return base;
}

/*
 * `.invalid` is reserved by RFC 2606 and can never be a real domain, so a
 * leaked fixture address cannot mail a stranger. The random suffix keeps
 * concurrent runs — CI and a laptop against the same preview — from colliding.
 */
const FIXTURE_EMAIL = `parity-${crypto.randomUUID().slice(0, 8)}@parity-check.invalid`;

/*
 * Mirrors `fixtureSinkPath` in src/lib/auth-fixture-sink.ts. Duplicated rather
 * than imported because this file is plain .mjs and that one is TypeScript;
 * if the sink moves, both move. The read below fails loudly if it does not.
 */
function sinkPath(email) {
  return path.join(os.tmpdir(), "cornerstone-parity", `${email.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.txt`);
}

// chrome: "both" = Header + Footer, "header" = Header only, "none" = bare
const ROUTES = [
  // Public — reachable signed in or out.
  { path: "/", guard: "public", chrome: "both" },
  { path: "/funfacts", guard: "public", chrome: "both" },
  { path: "/resources", guard: "public", chrome: "both" },
  { path: "/gallery", guard: "public", chrome: "both" },
  { path: "/stories", guard: "public", chrome: "both" },
  { path: "/characters/momotaro", guard: "public", chrome: "both" },
  { path: "/forgot-password", guard: "public", chrome: "both" },

  // Redirects.
  { path: "/charinfo", guard: "redirect", to: "/gallery", chrome: null },
  { path: "/definitely/not/a/route", guard: "redirect", to: "/", chrome: null },

  // Signed-out only — a signed-in user with nowhere particular to be is
  // bounced to /lessons.
  { path: "/auth", guard: "public-only", chrome: "both" },

  /*
   * ...but one who arrived carrying a destination is returned to it, rather
   * than dumped on the default. `from` is narrowed to a relative path first
   * (`lib/return-path.ts`), which is why the off-site case below lands on
   * /lessons instead of leaving the site — that one is a security regression
   * test, not a preference.
   */
  { path: "/auth?from=%2Fprofile", guard: "public-only-from", to: "/profile", chrome: "both" },
  {
    path: "/auth?from=https%3A%2F%2Fattacker.example.com",
    guard: "public-only-from",
    to: "/lessons",
    chrome: "both",
  },

  /*
   * There is one sign-in surface (#52), and no live users to preserve old
   * bookmarks for — the shims that used to forward here are gone, so these
   * paths now fall through to the catchall like any other unmapped route.
   */
  { path: "/login", guard: "redirect", to: "/", chrome: null },
  { path: "/signup", guard: "redirect", to: "/", chrome: null },

  // Signed-in only — a signed-out user is bounced to /auth.
  { path: "/dashboard", guard: "protected", chrome: "header" },
  { path: "/lessons", guard: "protected", chrome: "both" },
  { path: "/watch", guard: "protected", chrome: "both" },
  { path: "/talk", guard: "protected", chrome: "both" },
  { path: "/profile", guard: "protected", chrome: "both" },
  // Where a brand-new account lands after proving its address (#55).
  { path: "/welcome", guard: "protected", chrome: "both" },
  { path: "/lessons/hiragana-l1-v1-hokkaido", guard: "protected", chrome: "none" },
  { path: "/lessons/grammar-l1-v1", guard: "protected", chrome: "none" },
];

const HEADER_MARK = "Nihon-Go!";
const FOOTER_MARK = "All Rights Reserved";

/*
 * ── What the CMS section expects ────────────────────────────────────────────
 *
 * Every value here is an assertion about *content*, not about status codes.
 * That distinction is the whole point of this section: an empty database
 * serves /resources with a 200 and nothing on it, so "returned 200" is exactly
 * the check that would miss the failure this is here to catch.
 *
 * Eight resource groups is the volume the import already gates on — EXPECTED in
 * scripts/migrate/01-content-to-payload.ts, from the survey in docs/MIGRATION_PLAN.md.
 * Their names, and the lesson marks, are transcribed from the imported content
 * itself. If content is deliberately added or renamed, these move with it; that
 * they have to be edited by hand is the feature, not the friction.
 */
const CMS = {
  /*
   * Payload appends this to every admin <title> (admin.meta.titleSuffix in
   * src/payload.config.ts). Matching on it proves *our* Payload config booted,
   * rather than that something answered at /admin.
   *
   * The suffix, not the whole title: which view the admin is showing cannot be
   * read off the HTML — see checkAdminBoots.
   */
  adminTitleSuffix: "— Nihon-Go! CMS",

  /* The collection backing the admin login — CmsAdmins.slug. */
  adminCollection: "cms_admins",

  /*
   * The pages that have to come back with something on them, and the body text
   * that can only be there if Payload returned a document.
   *
   * For the lesson those marks are the five characters of its first flashcard
   * deck and the prompt of one of its exercises. Its title is deliberately not
   * among them — "Lesson 1" is too generic to prove anything.
   */
  content: [
    {
      path: "/resources",
      unit: "categories",
      marks: ["Reading", "Podcasts", "Writing", "Organizations", "Shows", "Videos", "Textbooks", "News"],
    },
    /*
     * The kana marks changed shape in Phase 4a, and the reason is the point of
     * the phase.
     *
     * They used to be the literal strings `"あ/ア"` on a `flashcardDeck` — the
     * pair encoded in one field with a slash, split on that slash in four
     * separate places. The delimiter *was* the schema. They are now a `vocabList`
     * referencing kana terms that hold `japanese` and `katakana` as their own
     * fields, so how the pair is displayed is the renderer's decision and the
     * string `"あ/ア"` does not exist anywhere any more.
     *
     * The marks are the term keys instead, which is a stronger assertion than
     * before: a key can only be in the payload if the *relationship* resolved,
     * where the old marks only proved a string had been stored. `blockType` is
     * included so a lesson silently reverting to the old blocks fails here.
     *
     * They are checked against the payload rather than rendered text because the
     * library blocks render client-side — the players are client components, so
     * the server HTML carries the document, not the screen.
     */
    {
      path: "/lessons/hiragana-l1-v1-hokkaido",
      unit: "content marks",
      marks: ["あ-ア", "い-イ", "う-ウ", "え-エ", "お-オ", "vocabList", "listenAndChoose"],
    },
    /*
     * The media check, and it has to be a step lesson: neither flashcard lesson
     * references a single file, so the marks above could never have caught a
     * media regression.
     *
     * Block media is an `upload` relationship now, and its failure mode is
     * silence — too shallow a read `depth`, or an access rule that denies the
     * populate, and every asset resolves to nothing while the page still
     * renders and still returns 200. `/api/media/file/` is what a resolved
     * relationship looks like once it reaches the HTML; the two filenames are
     * specific so that a page which renders *some* media but has lost these
     * still fails.
     *
     * A smoke check, not a proof. These lookups are wrapped in `unstable_cache`
     * with an hour's revalidate, so a run right after a code change can be
     * answered from a cache entry built before it — dropping the read depth to
     * 0 and re-running this still passed. `npm run content:verify` is the
     * deterministic one: it reads straight through Payload at the app's own
     * depth, with no cache in front of it, and fails on every unpopulated
     * upload.
     */
    {
      path: "/lessons/grammar-l1-v1",
      unit: "media marks",
      marks: [
        "/api/media/file/",
        "Hajimemashite_aodjal.m4a",
        "Konnichiwa_putqgw.m4a",
      ],
    },
  ],
};

async function authRequest(path, { method = "POST", body, cookie } = {}) {
  try {
    return await fetch(`${BASE}/api/auth/${path}`, {
      method,
      headers: headers({
        "Content-Type": "application/json",
        Origin: BASE,
        ...(cookie ? { cookie } : {}),
      }),
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "manual",
    });
  } catch (err) {
    console.error(`Could not reach ${BASE} — is the server running?`);
    console.error(`  ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }
}

/**
 * Body text as a printable line, for error messages. Returns "" when there is
 * nothing to show — a 500 from better-auth often has an empty body — so the
 * caller can skip the line instead of printing a blank one. Never throws: this
 * only runs on the failure path.
 */
async function detail(res) {
  let body = "";
  try {
    body = (await res.text()).trim().slice(0, 300);
  } catch {
    return "";
  }
  return body ? `  ${body}` : "";
}

/** Prints a detail line only when there is one. */
function printDetail(line) {
  if (line) console.error(line);
}

/*
 * A 401 from a deployment we have no bypass for is Vercel's auth wall, not the
 * app rejecting anything — the request never got that far. Saying so here is
 * the difference between a two-minute fix and an afternoon spent debugging a
 * deployment that was fine all along, which is the failure this whole feature
 * exists to prevent.
 */
function printWallHint(status) {
  if (status !== 401 || BYPASS_SECRET) return;
  console.error(
    "\n  A 401 on the first request usually means Vercel Authentication answered\n" +
      "  instead of the app — preview URLs and *.vercel.app are protected (#32).\n" +
      "  Set VERCEL_AUTOMATION_BYPASS_SECRET (Vercel → Settings → Deployment\n" +
      "  Protection → Protection Bypass for Automation) and run it again."
  );
}

/**
 * Signs the fixture in with a one-time code, creating the account on the way:
 * better-auth's email-OTP sign-in registers an address it has not seen before,
 * which is what replaces the closed password signup.
 */
async function signInFixture() {
  const sink = sinkPath(FIXTURE_EMAIL);
  rmSync(sink, { force: true });

  const sent = await authRequest("email-otp/send-verification-otp", {
    body: { email: FIXTURE_EMAIL, type: "sign-in" },
  });
  if (!sent.ok) {
    console.error(`\nCould not request a sign-in code (${sent.status}) for ${FIXTURE_EMAIL}.`);
    printDetail(await detail(sent));
    printWallHint(sent.status);
    process.exit(2);
  }

  /*
   * The code is written by `sendVerificationOTP` on the server, so this only
   * finds it when the server shares a filesystem with this script. Against a
   * remote target it will not be there, and that is the documented limit
   * rather than a bug — hence the specific message.
   */
  let code;
  try {
    code = readFileSync(sink, "utf8").trim();
  } catch {
    console.error(
      `\nThe sign-in code was not written to ${sink}.\n\n` +
        "  The server writes it there for @parity-check.invalid addresses only\n" +
        "  (src/lib/auth-fixture-sink.ts). If the target is a remote deployment,\n" +
        "  the file is on that host and this check cannot reach it — run parity\n" +
        "  against a local server instead.\n"
    );
    process.exit(2);
  }

  const res = await authRequest("sign-in/email-otp", {
    body: { email: FIXTURE_EMAIL, otp: code },
  });
  rmSync(sink, { force: true });

  if (!res.ok) {
    console.error(`\nSign-in failed (${res.status}) for ${FIXTURE_EMAIL}.`);
    printDetail(await detail(res));
    printWallHint(res.status);
    process.exit(2);
  }

  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

/*
 * Removes the throwaway account. There is no password to offer now, so this
 * relies on better-auth's session-freshness window instead — the session is
 * minutes old by the time the routes have been walked, which is inside it.
 *
 * A failure here is reported but does not fail the run: the parity result is
 * about the routes, and a leftover fixture is a tidiness problem, not a
 * regression. It prints the address so it can be removed by hand.
 */
async function removeFixture(cookie) {
  const res = await authRequest("delete-user", { method: "POST", body: {}, cookie });

  if (!res.ok) {
    console.warn(
      `\n⚠ Could not delete the parity fixture account (${res.status}).\n` +
        `  Remove it by hand: ${FIXTURE_EMAIL}`
    );
  }
}

async function visit(path, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    headers: headers(cookie ? { cookie } : {}),
    redirect: "manual",
  });
  const location = res.headers.get("location");
  const body = res.status === 200 ? await res.text() : "";
  return { status: res.status, location, body };
}

/** What the CRA app would have done for this route in this auth state. */
function expected(route, signedIn) {
  if (route.guard === "redirect") return { kind: "redirect", to: route.to };
  if (route.guard === "protected" && !signedIn) return { kind: "redirect", to: "/auth" };
  if (route.guard === "public-only" && signedIn) return { kind: "redirect", to: "/lessons" };
  // Same rule, but the destination is the route's own — signed out it still
  // just renders the sign-in screen.
  if (route.guard === "public-only-from" && signedIn) return { kind: "redirect", to: route.to };
  return { kind: "render" };
}

function describe(result) {
  if (result.status >= 300 && result.status < 400) return `${result.status} → ${result.location}`;
  return String(result.status);
}

let failures = 0;
const rows = [];

async function check(route, signedIn, cookie) {
  const want = expected(route, signedIn);
  const got = await visit(route.path, signedIn ? cookie : undefined);
  const state = signedIn ? "in " : "out";
  let ok, note;

  if (want.kind === "redirect") {
    // Path only, unless the expectation itself names a query — comparing
    // pathname alone would pass on a redirect that silently dropped it.
    const url = got.location ? new URL(got.location, BASE) : null;
    const target = url
      ? want.to.includes("?")
        ? `${url.pathname}${url.search}`
        : url.pathname
      : null;
    ok = got.status >= 300 && got.status < 400 && target === want.to;
    note = ok ? `→ ${want.to}` : `expected → ${want.to}, got ${describe(got)}`;
  } else {
    ok = got.status === 200;
    note = ok ? "renders" : `expected 200, got ${describe(got)}`;

    // Chrome only matters on a page that actually rendered.
    if (ok && route.chrome) {
      const hasHeader = got.body.includes(HEADER_MARK);
      const hasFooter = got.body.includes(FOOTER_MARK);
      const wantHeader = route.chrome !== "none";
      const wantFooter = route.chrome === "both";
      if (hasHeader !== wantHeader || hasFooter !== wantFooter) {
        ok = false;
        note = `chrome mismatch: header ${hasHeader}/${wantHeader}, footer ${hasFooter}/${wantFooter}`;
      } else {
        note = `renders (${route.chrome})`;
      }
    }
  }

  if (!ok) failures++;
  rows.push(`  ${ok ? "✓" : "✗"} [${state}] ${route.path.padEnd(34)} ${note}`);
}

// ── The CMS ──────────────────────────────────────────────────────────────────

const cmsRows = [];
let cmsFailures = 0;

/**
 * Records one CMS result. `note` says what was true when it passed as well as
 * what was wrong when it did not: "renders" tells you nothing you could act on
 * at 3am during a cutover, whereas "8/8 categories" does.
 */
function recordCms(label, ok, note) {
  if (!ok) cmsFailures++;
  cmsRows.push(`  ${ok ? "✓" : "✗"} ${label.padEnd(40)} ${note}`);
}

/**
 * Asserts that a page renders, and that every one of `marks` appears in what it
 * rendered — the second half being the part a status code cannot tell you.
 *
 * The failure note names the marks that were absent rather than only counting
 * them, because "missing Podcasts, News" and "missing all eight" are different
 * problems: one is a content edit, the other is an empty database.
 *
 * Scope, honestly: both pages hand their content to a client component, so a
 * mark can be matched in the serialised RSC payload rather than in rendered
 * markup. That is enough to prove Payload returned the document — which is
 * what this section claims — but it is not a claim about what a human sees.
 * The manual pass in docs/CUTOVER.md still covers that.
 */
async function checkContent({ path, unit, marks }, cookie) {
  const label = `${path} content`;
  const got = await visit(path, cookie);
  if (got.status !== 200) {
    recordCms(label, false, `expected 200, got ${describe(got)}`);
    return;
  }

  const absent = marks.filter((m) => !got.body.includes(m));
  const found = marks.length - absent.length;
  recordCms(
    label,
    absent.length === 0,
    absent.length === 0
      ? `${found}/${marks.length} ${unit}`
      : `200 but only ${found}/${marks.length} ${unit} — missing ${absent.join(", ")}`
  );
}

/*
 * The admin is mounted and boots — and that is the whole claim, deliberately.
 *
 * A 5xx here is the signature of the two ways the admin dies on a fresh
 * environment: PAYLOAD_SECRET unset, or the payload schema never migrated.
 * Verified, not assumed — with the secret blank this route answers 500 while
 * still emitting the right <title>, which is why status is tested first.
 *
 * Which view the admin is showing cannot be asserted from here. Payload sends
 * an unbootstrapped admin to create-first-user through `redirect()` inside the
 * server component (@payloadcms/next Root/index.js), and Next answers that
 * with 200 plus a client-side navigation rather than a 3xx — so the login and
 * create-first-user screens are indistinguishable over HTTP: same status, same
 * "Login — …" title, and both screens' strings present in either body because
 * they ship in one bundle. Asserting "this is the login screen" from the HTML
 * would be a check that passes on a deployment showing the bootstrap form.
 * That distinction is checkBootstrapClosed's job, and it reads it from
 * Payload's own `initialized` flag instead of guessing at markup.
 */
async function checkAdminBoots() {
  const got = await visit("/admin/login");
  if (got.status !== 200) {
    recordCms("/admin boots", false, `expected 200, got ${describe(got)}`);
    return;
  }
  const ok = got.body.includes(CMS.adminTitleSuffix);
  recordCms(
    "/admin boots",
    ok,
    ok
      ? "Payload admin renders"
      : `200 but no "${CMS.adminTitleSuffix}" — is this Payload's admin?`
  );
}

/*
 * The bootstrap window is shut (#32).
 *
 * While zero cms_admins rows exist, Payload offers first-user creation to
 * anyone who reaches /admin, unauthenticated — one form submission away from a
 * stranger owning the CMS. Payload publishes exactly this as `initialized`, so
 * the check is a straight read rather than an inference from a rendered page.
 */
async function checkBootstrapClosed() {
  const label = "admin bootstrap closed";
  const res = await fetch(`${BASE}/api/${CMS.adminCollection}/init`, {
    headers: headers(),
    redirect: "manual",
  });
  if (!res.ok) {
    recordCms(label, false, `GET /api/${CMS.adminCollection}/init returned ${res.status}`);
    return;
  }

  let initialized;
  try {
    ({ initialized } = await res.json());
  } catch {
    recordCms(label, false, "init did not return JSON");
    return;
  }

  recordCms(
    label,
    initialized === true,
    initialized === true
      ? `a ${CMS.adminCollection} account exists`
      : "NO admin account — /admin offers first-user creation to anyone. Run `npm run payload:seed-admins`"
  );
}

console.log(`Parity check against ${BASE}`);
console.log(`Signing in a throwaway account for the signed-in half: ${FIXTURE_EMAIL}\n`);

const cookie = await signInFixture();

// finally, not just the happy path: a failed assertion must not leave the
// fixture behind, or the next run against this target starts dirty.
try {
  for (const route of ROUTES) {
    await check(route, false, cookie);
    // A redirect that ignores auth only needs checking once.
    if (route.guard !== "redirect") await check(route, true, cookie);
  }

  /*
   * The CMS section runs here, inside the try, because the lesson page is
   * behind auth and needs the fixture session — which the `finally` is about
   * to take away.
   *
   * The two content pages fail differently on an empty database, which is why
   * both are checked: /resources still answers 200 with nothing on it, while
   * the lesson redirects to /dashboard once its slug resolves to nothing. The
   * lesson is therefore covered twice, here and in the route table; that is
   * deliberate, so that both halves of "there is no content" get reported
   * under the heading that explains what to do about it.
   */
  await checkAdminBoots();
  await checkBootstrapClosed();
  for (const page of CMS.content) await checkContent(page, cookie);
} finally {
  await removeFixture(cookie);
}

console.log(rows.join("\n"));
console.log(
  `\n${rows.length - failures}/${rows.length} checks passed` +
    (failures ? ` — ${failures} FAILED` : " — full parity with the CRA route table")
);

console.log("\nCMS");
console.log(cmsRows.join("\n"));
console.log(
  `\n${cmsRows.length - cmsFailures}/${cmsRows.length} CMS checks passed` +
    (cmsFailures ? ` — ${cmsFailures} FAILED` : " — admin is up and content is served by Payload")
);

process.exit(failures || cmsFailures ? 1 : 0);
