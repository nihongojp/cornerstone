# Cornerstone

A Japanese-language learning app. This glossary fixes the terms whose meaning has
actually been contested during design work — not every concept in the codebase.

## Language

### Identity

**Asserted**:
An identity provider's claim about an email address, carried in the profile it
returns. Google asserting `email_verified: true` is a claim we choose to accept.
_Avoid_: verified (ambiguous — see **Proven**)

**Proven**:
Our own record that this account's owner controls its address, stored as
`user.emailVerified`. Established by an action taken against us — following a
magic link, entering an email OTP, completing verification — never by a third
party's say-so.
_Avoid_: verified (ambiguous — see **Asserted**)

**Link**:
Attaching an additional sign-in method to an existing account, so one person
reaching us by several paths lands in one place. Gated on the account being
**Proven**, because linking on an unproven address is an account-takeover
vector.
_Avoid_: merge (implies combining two existing accounts, which we never do)

**Learner account**:
A row in `public.user` — someone who uses the app. Distinct from an **Editor**,
which is a Payload `cms_admins` row. The two are separate systems on purpose.
_Avoid_: user (overloaded: also a role value, and the table name)

**Editor**:
Someone who edits content through the Payload admin. Authenticated by
`cms_admins`, entirely separate from a **Learner account**.
_Avoid_: admin (overloaded — see the `admin` role value)

### Roles

Values of `role` on a **Learner account**.

`role` **gates nothing, and nothing currently planned changes that.** Access is
decided solely by whether a request carries a session — `requireSession()` /
`requirePlayerAccess()` — and every registered learner gets the whole product.
There is no free tier and no per-course entitlement; both were considered and
rejected (#56).

The column is kept because it costs nothing to keep and would have to be re-added
the day there is something to charge for. Until then, treat these values as
reserved names rather than a live permission system, and do not write code that
branches on them without settling #56 first.

**admin**:
Reserved for elevated privilege over other learner accounts. Nothing reads it.

**member**:
A registered learner.

**user**:
The default for a new account. Despite the name, not a lesser tier than
`member` today — nothing distinguishes them.

## Content model

What the CMS holds, and how the pieces relate:

```
Course ──< Lesson ──< Step ──< Block ──> Term
                                          ▲
         user_progress ─── keyed on lesson slug
```

**Course**: an ordered track (`hiragana-and-prefectures`, `grammar-and-conversation`).
A lesson's place in it is `lessons.order`.

**Lesson**: one playable thing. `level` and `part` are what a learner is shown —
the lessons list groups every course's lessons into "Lesson `<level>`" sections
and labels each card "Lesson `<level>`.`<part>`". **`level` spans courses**: the
"Lesson 1" heading holds both the grammar lesson and the hiragana one, so it is
not a position within a course — `order` is that.

**Step**: one screen. An ordered row of `lesson.steps`. A step is *not*
necessarily a question — it can be pure prose. What makes it interactive is the
blocks on it (`PRACTICE_BLOCK_SLUGS`). Named `step` to match
`user_progress.last_step` / `step_key` and the step-through player; it was
`exercise`, which promised a question half of them do not have.

**Block**: one authored widget on a step — prose, a flashcard deck, a multiple
choice. Schemas live in `src/payload/blocks/` (what an author picks in `/admin`);
the React renderers live in `src/components/blocks/`. Two layers, on purpose:
Payload's config is loaded by its CLI in plain Node, where a `"use client"`
component would break it.

**Term**: one vocabulary entry — a kana character, a kanji, a word, or a phrase,
discriminated by `kind`. One collection rather than three because they share
almost every field and any block referencing one could reference any of them.
A single character *is* an entry: あ carries audio, stroke order, romaji and its
katakana counterpart, exactly as a word does.

**Progress** (`user_progress`, Postgres `public` — not Payload) keys on the
lesson **slug**, not a database id, and resumes by `step_key`. It is per-lesson
only; there is no per-term mastery or review queue yet.

## Routing

Route segments, groups and dynamic params follow Next.js's own App Router
conventions, and CMS field conventions follow Payload's own — this section
only records what neither framework's docs can decide for us.

**Dynamic params** are named for what the value structurally is, not the
collection it came from — a Payload `slug` field is a `[slug]`, not an
`[id]` or a `[lessonId]`, unless the value really is a database identifier.

**CMS slug format** (`lessons.slug`, `courses.slug` — URL-facing, ASCII):
`<family>-l<level>-v<version>[-<variant>]` — e.g. `grammar-l1-v1`,
`hiragana-l2-v1-akita`. `<family>` is the content line (`hiragana`,
`grammar`, ...), always present. `<variant>` is optional, present only
when family+level+version alone would collide (today: the prefecture a
hiragana lesson is tied to). It is *not* guaranteed to match the lesson's
own `prefecture` field — the two are independently editable. Courses use a
plain kebab-case descriptive phrase instead (no level/version). Enforced
by a field-level `validate` (`src/payload/fields/slugFormat.ts`);
uniqueness is each field's own `unique: true`. `terms.key` is deliberately
excluded — it isn't routed, and kana/kanji entries key on the script
itself (`あ-ア`), which an ASCII rule would reject outright.

**Route groups**, which auth gate + which chrome:

| Group | Auth gate | Chrome |
|---|---|---|
| `(public)` | none | Header and Footer |
| `(learn)` | signed-in | Header and Footer |
| `(dashboard)` | signed-in | Header, no Footer |
| `(player)` | learner session **or** CMS editor previewing | none |

A new page picks whichever row matches the auth + chrome it needs — these
are two independent axes, not competing patterns. All four sit inside
`(app)`, which holds the single root layout (html, theme, analytics) so
navigating between them does not full-reload.

`/auth` is the exception and guards itself, in `auth/page.tsx`: it sends a
signed-in visitor to their `from` destination, and a layout is never given
`searchParams`, so the rule cannot live in a group.
