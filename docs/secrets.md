# Secrets

API keys, tokens and passwords can be kept out of notes, in one locked note, and used by name anywhere: `{{github}}`. ([#166](https://github.com/overtio/lines/issues/166))

## Where they're kept

A **secrets note** is a [locked note](../README.md#sync-and-privacy) whose type is `secrets`. Its properties are the secrets, by name:

```markdown
---
type: secrets
github: ghp_…
stripe: sk_live_…
---
# Secrets
```

To make one: start a note, type `/properties`, set its type to `secrets` and add a property for each secret, then lock it (the lock in its toolbar). It's encrypted like any locked note: on this device, and wherever it syncs to. One password (or Touch ID, in the Mac app) opens it with the other locked notes, and it locks again with them after 5 minutes without use. A locked note's text is left out of search, tags and type tables.

Only locked notes count: a note of type `secrets` that isn't locked isn't read for secrets. There can be more than one secrets note; where two have a secret by the same name, the older note's is used.

## Using one

- **In a request** ([requests.md](requests.md)): `Authorization: Bearer {{github}}`. A name with no `@github = …` variable is a secret. JetBrains' editors fill `{{github}}` from their private environment file the same way, so the request still works there.
- **In any Markdown note**: `{{github}}` outside code shows as a key, the name and dots, with **Show** (for 15 seconds, or until its note locks) and **Copy**. A name with no secret has an outline instead, and says so. `/secret` writes `{{}}`.

While locked notes are closed, sending a request that uses a secret, showing one or copying one asks for their password (or Touch ID) first. Cancelled, nothing's sent or copied, and the request's response says why.

## What never holds the value

- **The note**: it has `{{github}}`, and so does every copy of it: Markdown, plain text, exports, and other Markdown apps, which show `{{github}}` as written.
- **Printing and PDFs**: the name and dots.
- **The response panel**: the request's address shows a secret in it as `••••`.
- **Copy as curl**: a shell variable, `"Bearer ${GITHUB}"`, so the shell fills it in from its environment rather than the clipboard holding it.
- **A request added from a response's address**: its headers are copied as written, `{{github}}`.

What the server sends back can still contain a secret (an echo service, say), and a response's **+** writes its body into the note as it came.

## Turning it off

The Secrets plugin draws `{{name}}` in Markdown notes; turned off, `{{github}}` is text again. Requests use secrets either way.

## Not yet

- Suggesting secrets' names after `{{`.
- A button that makes the secrets note.
- Showing a secrets note's own values as dots: they show in its properties while it's open.
- lines' own secrets (the S3 sync keys, in local storage now) aren't kept this way yet.
