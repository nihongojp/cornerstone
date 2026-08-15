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
 */

const BASE = process.argv[2] || "http://localhost:3000";

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
  { path: "/login", guard: "public-only", chrome: "both" },
  { path: "/signup", guard: "public-only", chrome: "both" },

  // Signed-in only — a signed-out user is bounced to /auth.
  { path: "/dashboard", guard: "protected", chrome: "header" },
  { path: "/new-lessons", guard: "protected", chrome: "both" },
  { path: "/watch", guard: "protected", chrome: "both" },
  { path: "/talk", guard: "protected", chrome: "both" },
  { path: "/profile", guard: "protected", chrome: "both" },
  { path: "/lesson/hiragana-l1-v1-hokkaido", guard: "protected", chrome: "none" },
  { path: "/newlesson/l1-v1", guard: "protected", chrome: "none" },
];

const HEADER_MARK = "Nihon-Go!";
const FOOTER_MARK = "All Rights Reserved";

async function authRequest(path, { method = "POST", body, cookie } = {}) {
  try {
    return await fetch(`${BASE}/api/auth/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Origin: BASE,
        ...(cookie ? { cookie } : {}),
      },
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
  console.error(
    "\n  If this target does not accept signups, point the check at an existing\n" +
      "  account instead: PARITY_EMAIL=… PARITY_PASSWORD=… npm run parity"
  );
  process.exit(2);
}

async function signIn() {
  const res = await authRequest("sign-in/email", { body: CREDENTIALS });
  if (!res.ok) {
    console.error(`Sign-in failed (${res.status}) for ${CREDENTIALS.email}.`);
    console.error(
      SUPPLIED_FIXTURE
        ? "  PARITY_EMAIL / PARITY_PASSWORD do not match an account on this target."
        : "  The fixture account was created but could not sign in — that should not happen."
    );
    printDetail(await detail(res));
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
    headers: cookie ? { cookie } : {},
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
} finally {
  await removeFixture(cookie);
}

console.log(rows.join("\n"));
console.log(
  `\n${rows.length - failures}/${rows.length} checks passed` +
    (failures ? ` — ${failures} FAILED` : " — full parity with the CRA route table")
);
process.exit(failures ? 1 : 0);
