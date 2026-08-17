# Content backlog

Five things in the CMS need an author rather than a developer. None of them break the site;
all five were invisible before the recent CMS work and are now countable, which is the only
reason this list exists.

Written 2026-08-17, against the `claude/payload-cms-improvements-3b72de` branch, and updated after
Phase 4b. The counts come from `npm run content:verify`, which reprints them on every run — treat
that as the live version of this document.

## What changed in the admin first

Two things look different, and both matter for the work below.

**Every screen is authored.** The player used to invent some of them: it generated the
stroke-order screens from a table in the code, and generated the practice batches fresh on every
visit. Both are real, editable exercises now, so what you see in the Exercises list is what a
learner gets. One consequence worth knowing: a lesson with **Shuffle Exercises** ticked varies the
order of consecutive practice screens of the same kind per learner, so two people can meet the
same exercises in different orders. Screens that present material never move.

**Media is a picker now, not a URL box.** Component fields used to say "Image URL" and expect you
to upload a file, copy its address, and paste it in. They now say "Image", "Audio" or "Video" and
open the media library. The old way meant a file had no idea which lessons used it, so renaming
or replacing one broke them silently. Picking a file links it properly.

**There is a Vocabulary section.** Every word, phrase, kana and kanji the lessons teach is now a
row in one place, with its own audio, image, reading and romaji. 41 of them, built from the words
already in the lessons. The point is that a word is authored once: attach audio to こんにちは
there, and every lesson using it gets that audio. Previously the same phrase was typed into five
different exercises and its audio attached to whichever copy someone happened to be editing.

---

## 1. Placeholder text — removed from the site, waiting on the real copy

**Status: no longer live.** Phase 4b removed these eight blocks from `l1-v2` rather than
carrying them onto the new block library. Learners no longer see `PLACEHOLDER_PHRASE_SAN`,
`PLACEHOLDER_PHRASE_JIN` or `PLACEHOLDER_TRANSLATION` anywhere. The lesson stayed published and
lost eight screens, going from 32 exercises to 24.

Nothing was thrown away: every removed block is in `content/quarantine.json` with its lesson, its
position and all of its field values. **That file is now the only copy** — restore from it, not
from the site.

Removing them cost nothing, because none of the eight worked. All had `audio: null` and
`image: null`, so the two "match the audio" screens played silence, the two pronunciation screens
had no reference recording to score against, the two term-media seeds seeded nothing, and the
matching exercise paired two placeholder strings with two placeholder translations. The eighth
was a text page that only ever had a title.

**What is still owed, and it is an authoring decision.** Exercise 16's own description read
*"Matches of phrases using ~ san and ~ jin"*. Exercise 15 teaches `~ san` as a grammar pattern and
exercise 38 lists `~ san` and `~ jin` on a Terms page, in the same order as the two placeholders —
so `SAN` wanted `~ san` and `JIN` wanted `~ jin`. What was never written down is the actual
phrases these exercises were meant to drill: "using ~ san" implies a name plus the suffix, not the
bare pattern. That is the part only an author can supply.

**To put them back**, author the phrases as `terms` in the Vocabulary section, then add
`listenAndChoose`, `speakAndScore` and `matchPairs` blocks referencing them. The new blocks read
audio and images from the term, so a recording added once covers every exercise using that word.

## 2. 24 of 41 vocabulary terms have no Japanese script

Everything imported from the old content is romaji only — `Hajimemashite`, never はじめまして.
The Japanese was never written down anywhere, so there was nothing to import.

The Vocabulary section has a **Japanese** field for the written form and a **Reading** field for
its kana. Filling these in is what unlocks showing learners real Japanese rather than romanised
Japanese, and it is a prerequisite for furigana.

Kana and kanji entries already have theirs — the character *is* the entry, so the field is
required for those. The 24 are all words and phrases. `npm run content:derive-terms` prints the
current count.

## 3. Every media file is missing alt text

All 33 files in the media library have an empty **Alt** field, and a caption that just reads
"Migrated from Cloudinary". Alt text is what a screen reader announces in place of the image, so
right now a learner using one gets nothing.

New image uploads now refuse to save without it. The existing 33 predate that rule and have to be
filled in by hand. Audio and video do not need alt text and are not affected.

A useful shortcut: most of these are stroke-order diagrams and vocabulary pictures, so the alt
text is usually the word plus what the picture shows — "stroke order for あ", "a bowl of rice".

## 4. Four vocabulary entries were merged automatically — please confirm

Building the vocabulary list meant recognising that the same word had been typed several
different ways across the lessons. Four pairs were merged into one entry each:

| Kept as | Merged from |
|---|---|
| `konnnichiwa` | `Konnnichiwa`, `Konnichiwa` |
| `okagesamade` | `Okagesamade`, `Okagesama de` |
| `desu-ka` | `~ desu ka`, `~ desu ka.` |
| `dore` | `Dore`, `dore` |

All four look like the same word spelled inconsistently, which is why they were merged. But the
rule that spotted them works by ignoring doubled letters, and in Japanese a doubled vowel can be
the whole difference between two words — おばさん is an aunt, おばあさん is a grandmother. So this
is worth one read-through rather than a shrug.

If any pair is genuinely two words, split it in `content/terms.json` (each entry lists what it
absorbed under `mergedFrom`) and re-run `npm run content:derive-terms -- --seed`. Once confirmed,
that file is the record and the merging rule is never used again.

---

## 5. Most of the vocabulary has no pronunciation audio

**30 of the 41 terms have no recording.** That leaves **21 listening exercises with nothing to
play** — the learner is asked "which word did you hear?" and hears silence.

This is not new and it is not a side effect of the rework: the old `matchAudioLetter` blocks never
had an audio field filled in either, so those screens have always been silent. What changed is that
it is now countable. Audio used to be attached to whichever *copy* of a word an author happened to
be editing, and a helper guessed at render time which copies meant the same word; now a word has one
place for its recording, so "does this word have audio?" has an answer.

The five kana sets are the biggest block of it:

| Terms with no audio | Where it shows |
|---|---|
| `あ-ア` `い-イ` `う-ウ` `え-エ` `お-オ` | 5 listening exercises in `hiragana-l1-v1-hokkaido` |
| `か-カ` `き-キ` `く-ク` `け-ケ` `こ-コ` | 5 listening exercises in `hiragana-l2-v1-iwate` |
| `desu` `desu-ka` | 2 in `l1-v2` |
| `sumimasen-wakarimasen`, `mouichido-onegaishimasu`, `yukkuri-onegaishimasu`, `kore`, `sore`, `are`, `dore`, `kore-ha-nandesuka`, `sore-ha-nandesuka` | the rest, in `l2-v1` |

A recording on the term fixes every exercise that references it at once — that is the whole point of
the vocabulary collection. Upload the clip to the term's own Audio field in the CMS
(Vocabulary → the word → Audio); nothing else needs touching.

Separately, **11 speaking exercises have no reference audio**, so a learner can record themselves
but nothing can be scored. Same fix, same field.

`npm run content:verify` prints both counts on their own lines, so they go down as recordings land.

---

## Checking your work

`npm run content:verify` reads every published lesson and reports the placeholder strings and any
media that failed to load. It exits with an error only on genuine breakage — the editorial items
above are listed as to-dos, not failures, so the list getting shorter is the progress bar.
