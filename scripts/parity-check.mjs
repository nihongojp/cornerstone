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
 * So the check now brings its own. By default it signs up a throwaway account
 * over the public API, uses it, and deletes it again — leaving the target
 * exactly as it found it, whether that is localhost, a preview deploy, or
 * production. Set PARITY_EMAIL and PARITY_PASSWORD to use an existing account
 * instead, and it will neither create nor delete anything.
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
const SUPPLIED_FIXTURE = Boolean(process.env.PARITY_EMAIL && process.env.PARITY_PASSWORD);
const CREDENTIALS = SUPPLIED_FIXTURE
  ? { email: process.env.PARITY_EMAIL, password: process.env.PARITY_PASSWORD }
  : {
      email: `parity-${crypto.randomUUID().slice(0, 8)}@parity-check.invalid`,
      password: `parity-${crypto.randomUUID()}`,
    };

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

  // Signed-out only — a signed-in user is bounced to /new-lessons.
  { path: "/auth", guard: "public-only", chrome: "both" },

  /*
   * There is one sign-in surface now (#52), so these two only forward to it.
   * They still sit inside the (public-only) group, which means a signed-in
   * visitor is bounced to /new-lessons by the layout before the page's own
   * redirect ever runs — the destination therefore depends on auth state,
   * which "redirect" alone cannot express.
   */
  { path: "/login", guard: "public-only-redirect", to: "/auth", chrome: null },
  { path: "/signup", guard: "public-only-redirect", to: "/auth?mode=signup", chrome: null },

  // Signed-in only — a signed-out user is bounced to /auth.
  { path: "/dashboard", guard: "protected", chrome: "header" },
  { path: "/new-lessons", guard: "protected", chrome: "both" },
  { path: "/watch", guard: "protected", chrome: "both" },
  { path: "/talk", guard: "protected", chrome: "both" },
  { path: "/profile", guard: "protected", chrome: "both" },
  // Where a brand-new account lands after proving its address (#55).
  { path: "/welcome", guard: "protected", chrome: "both" },
  { path: "/lesson/hiragana-l1-v1-hokkaido", guard: "protected", chrome: "none" },
  { path: "/newlesson/l1-v1", guard: "protected", chrome: "none" },
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
    {
      path: "/lesson/hiragana-l1-v1-hokkaido",
      unit: "content marks",
      marks: ["あ/ア", "い/イ", "う/ウ", "え/エ", "お/オ", "Listen and choose the character you hear"],
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

async function signUpFixture() {
  const res = await authRequest("sign-up/email", {
    body: {
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
      name: "Parity Check",
      firstName: "Parity",
      lastName: "Check",
    },
  });
  if (res.ok) return;

  // A 500 here is almost always an unmigrated database — better-auth querying a
  // `user` table that does not exist yet. Worth naming, because the raw error
  // never reaches this script.
  console.error(`Could not create the parity fixture account (${res.status}).`);
  if (res.status >= 500) {
    console.error(
      "  A 5xx here usually means the database has no auth tables yet.\n" +
        "  Run `npm run db:migrate` (and `npm run payload:migrate`) against this environment."
    );
  }
  printDetail(await detail(res));
  printWallHint(res.status);
  console.error(
    "\n  If this target does not accept signups, point the check at an existing\n" +
      "  account instead: PARITY_EMAIL=… PARITY_PASSWORD=… npm run parity"
  );
  process.exit(2);
}

async function signIn() {
  const res = await authRequest("sign-in/email", { body: CREDENTIALS });
  if (!res.ok) {
    /*
     * Phase 1 turned on `requireEmailVerification` (#55), so a freshly created
     * account cannot sign in until its address is confirmed — and this script
     * only speaks HTTP, so it can never open the confirmation mail. Creating
     * the fixture here therefore stopped being possible; the run needs an
     * account that is already confirmed.
     *
     * Worth naming precisely, because the raw 403 reads like a wrong password.
     */
    if (res.status === 403) {
      console.error(
        `\nThe parity fixture cannot sign in: ${CREDENTIALS.email} is not confirmed.\n\n` +
          "  Sign-in now requires a confirmed email address, and this script has no\n" +
          "  way to open the confirmation link. Point it at an account that is\n" +
          "  already confirmed:\n\n" +
          "    PARITY_EMAIL=… PARITY_PASSWORD=… npm run parity\n"
      );
      process.exit(2);
    }

    console.error(`Sign-in failed (${res.status}) for ${CREDENTIALS.email}.`);
    console.error(
      SUPPLIED_FIXTURE
        ? "  PARITY_EMAIL / PARITY_PASSWORD do not match an account on this target."
        : "  The fixture account was created but could not sign in — that should not happen."
    );
    printDetail(await detail(res));
    printWallHint(res.status);
    process.exit(2);
  }
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

/*
 * Removes the throwaway account. `delete-user` accepts the password, which
 * skips better-auth's session-freshness check, so this works however long the
 * run took. An account supplied through the environment is never touched.
 *
 * A failure here is reported but does not fail the run: the parity result is
 * about the routes, and a leftover fixture is a tidiness problem, not a
 * regression. It prints the address so it can be removed by hand.
 */
async function removeFixture(cookie) {
  if (SUPPLIED_FIXTURE) return;

  const res = await authRequest("delete-user", {
    method: "POST",
    body: { password: CREDENTIALS.password },
    cookie,
  });

  if (!res.ok) {
    console.warn(
      `\n⚠ Could not delete the parity fixture account (${res.status}).\n` +
        `  Remove it by hand: ${CREDENTIALS.email}`
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
  if (route.guard === "public-only" && signedIn) return { kind: "redirect", to: "/new-lessons" };
  if (route.guard === "public-only-redirect") {
    return { kind: "redirect", to: signedIn ? "/new-lessons" : route.to };
  }
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
    const target = got.location ? new URL(got.location, BASE).pathname : null;
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
console.log(
  SUPPLIED_FIXTURE
    ? `Signing in as ${CREDENTIALS.email} (from PARITY_EMAIL)\n`
    : `Creating a throwaway account for the signed-in half: ${CREDENTIALS.email}\n`
);

if (!SUPPLIED_FIXTURE) await signUpFixture();
const cookie = await signIn();

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
