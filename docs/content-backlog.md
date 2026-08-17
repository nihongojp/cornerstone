# Content backlog

Four things in the CMS need an author rather than a developer. None of them break the site;
all four were invisible before the recent CMS work and are now countable, which is the only
reason this list exists.

Written 2026-08-17, against the `claude/payload-cms-improvements-3b72de` branch. The counts come
from `npm run content:verify`, which reprints them on every run — treat that as the live version
of this document.

## What changed in the admin first

Two things look different, and both matter for the work below.

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

## 1. Placeholder text is live on the site

**Where:** lesson `l1-v2`, ten places across eight exercises.

Learners currently see the literal strings `PLACEHOLDER_PHRASE_SAN`, `PLACEHOLDER_PHRASE_JIN` and
`PLACEHOLDER_TRANSLATION` on screen. These came through the Mongo import as-is — the import
blanked out placeholder *file* addresses but left placeholder *text* alone, and nothing since has
looked at it.

| Exercise | Block | Field | Value |
|---|---|---|---|
| 16 | Matching exercise | item 1 phrase | `PLACEHOLDER_PHRASE_SAN` |
| 16 | Matching exercise | item 1 English translation | `PLACEHOLDER_TRANSLATION` |
| 16 | Matching exercise | item 2 phrase | `PLACEHOLDER_PHRASE_JIN` |
| 16 | Matching exercise | item 2 English translation | `PLACEHOLDER_TRANSLATION` |
| 17 | Match audio | phrase | `PLACEHOLDER_PHRASE_SAN` |
| 18 | Match audio | phrase | `PLACEHOLDER_PHRASE_JIN` |
| 25 | Pronunciation | phrase | `PLACEHOLDER_PHRASE_SAN` |
| 26 | Pronunciation | phrase | `PLACEHOLDER_PHRASE_JIN` |
| 33 | Term media seed | term | `PLACEHOLDER_PHRASE_SAN` |
| 34 | Term media seed | term | `PLACEHOLDER_PHRASE_JIN` |

**The intent, from the lesson itself.** Exercise 16's own description field reads *"Matches of
phrases using ~ san and ~ jin"*. Exercise 15 teaches `~ san` as a grammar pattern, and exercise 38
lists `~ san` and `~ jin` on a Terms page, in that order — matching the order of the two
placeholders. So `SAN` wants `~ san` and `JIN` wants `~ jin`, and the two `PLACEHOLDER_TRANSLATION`
values want their English.

What is missing is the actual phrases these exercises were meant to drill — "using ~ san" implies
an example like a name plus the suffix, not the bare pattern. That part is a genuine authoring
decision, not a transcription.

**Two ways to fix it.** Replace the ten values in the admin, or unpublish `l1-v2` until the copy
is finished. Unpublishing is a status change and loses nothing; drafts are enabled on lessons.

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

## Checking your work

`npm run content:verify` reads every published lesson and reports the placeholder strings and any
media that failed to load. It exits with an error only on genuine breakage — the editorial items
above are listed as to-dos, not failures, so the list getting shorter is the progress bar.
