# Secrets

Keep API keys, tokens and passwords out of your notes: put them in a locked note of type `secrets`, and write `{{name}}` where one goes. Here's one: {{demo-key}}

It has an outline because no secret has that name yet. The next note, **My secrets**, has one: lock it, with the lock in its toolbar, and come back. Then the eye shows it for a moment, and the copy button copies it. Once locked notes close again, either asks for their password first.

In a request, `{{name}}` is a secret when no `@name = …` line names it:

```http
GET https://httpbin.org/headers
Authorization: Bearer {{demo-key}}
```

The response shows what the server got. The note only ever holds the name: copying, exporting and printing it never write the value, and Copy as curl writes `${DEMO_KEY}`, for your shell to fill in.

#tour
