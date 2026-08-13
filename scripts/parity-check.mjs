/**
 * P5 parity check — every CRA route, in both auth states, against the Next app.
 *
 *   node scripts/parity-check.mjs [baseUrl]
 *
 * The expectations below are transcribed from client/src/App.tsx: the route
 * table, the RequireAuth/PublicOnly wrappers, and the hideHeader/hideFooter
 * rules. This exists so parity is re-checkable after any change, rather than
 * being a one-off click-through.
 */

const BASE = process.argv[2] || "http://localhost:3000";
const CREDENTIALS = { email: "hanako@example.com", password: "momiji-newpass-2244" };

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

async function signIn() {
  let res;
  try {
    res = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: BASE },
      body: JSON.stringify(CREDENTIALS),
      redirect: "manual",
    });
  } catch (err) {
    console.error(`Could not reach ${BASE} — is the server running?`);
    console.error(`  ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(
      `Sign-in failed (${res.status}). The signed-in half of the check needs an account:\n` +
        `  ${CREDENTIALS.email}\n` +
        `Create it, or edit CREDENTIALS at the top of this script.`
    );
    process.exit(2);
  }
  return (res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
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

const cookie = await signIn();
console.log(`Parity check against ${BASE}\n`);

for (const route of ROUTES) {
  await check(route, false, cookie);
  // A redirect that ignores auth only needs checking once.
  if (route.guard !== "redirect") await check(route, true, cookie);
}

console.log(rows.join("\n"));
console.log(
  `\n${rows.length - failures}/${rows.length} checks passed` +
    (failures ? ` — ${failures} FAILED` : " — full parity with the CRA route table")
);
process.exit(failures ? 1 : 0);
