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

Values of `role` on a **Learner account**. They describe entitlement, not
identity.

**admin**:
Elevated privilege over other learner accounts.

**member**:
A registered learner. The tier paid features would eventually attach to.

**user**:
The unentitled tier.
