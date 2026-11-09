# API requests

Notes can hold requests to an API, to try it, explore it and keep what you learned beside it: a lighter [Bruno](https://www.usebruno.com) or Postman. The API Requests [plugin](plugins.md) sends them and shows the responses. ([#165](https://github.com/overtio/lines/issues/165))

Requests are written in the `.http` format, or in [Hurl](#hurl)'s, which adds checks of the response. The `.http` format is the one the JetBrains IDEs' HTTP Client, VS Code (REST Client and httpYac), Visual Studio and Neovim (kulala) read. It has a [published spec](https://github.com/JetBrains/http-request-in-editor-spec), so requests written in lines open in those editors, and theirs in lines.

## Where requests go

- **In a Markdown note**, in a code block whose language is `http` (or `rest`), or `hurl`. `/request` and `/hurl` add one. A note can have several, with writing between them.
- **A whole note of requests**: switch a note to HTTP Requests or Hurl in its ⓘ panel, or import a `.http`, `.rest` or `.hurl` file (Settings → Export and Import → Import). It's kept as the `.http` file it is, and exports as one. Its title is its first line as it reads (a `###` title, a comment or a request), and its `###` titles are its outline.

## Writing a request

```http
@api = https://api.example.com

### Sign in
# @name login
POST {{api}}/login
Content-Type: application/json

{ "user": "ada", "password": "{{password}}" }

### My profile
GET {{api}}/me
    ?fields=name,email
Authorization: Bearer {{login.response.body.$.token}}
```

- Requests are separated by lines starting with `###`; what follows it is the request's title.
- The request line is a method and an address (`GET https://…`), or just an address for a GET. `HTTP/1.1` after it is allowed, and ignored. An address without its scheme gets `http://` for `localhost` and `127.0.0.1`, and `https://` otherwise.
- Lines starting with `?` or `&`, indented, go on with the address.
- Then the headers, one `Name: value` to a line; then, after a blank line, the body.
- Before a request, and after its body, lines starting with `#` or `//` are comments, not sent. `#tag` in a comment is a tag of a `.http` note.

## Variables

- `@name = value` on a line of its own is a variable, used as `{{name}}` anywhere in a request: the address, headers or body. In a Markdown note, a variable in one block can be used in every other. A variable's value can use other variables.
- `{{$uuid}}` is a new UUID each time, `{{$timestamp}}` the time in seconds, `{{$isoTimestamp}}` and `{{$datetime iso8601}}` the time as ISO 8601 (`{{$datetime rfc1123}}` as HTTP writes it), and `{{$randomInt}}` a whole number from 0 to 999 (`{{$randomInt 1 7}}`, from 1 to 6).
- A request named with `# @name login` (above its request line) can be used by the requests after it, once it's been sent: `{{login.response.body.$.token}}` is a field of its JSON body, by [JSONPath](https://goessner.net/articles/JsonPath/) (`$.items[0].id`, `$['a key']`), `{{login.response.body.*}}` its whole body, and `{{login.response.headers.Location}}` a header. No scripts run: this is the same syntax VS Code's REST Client and Visual Studio use.

- A name that no `@name = value` line has is a **secret**, kept in a locked secrets note rather than the note: `Authorization: Bearer {{github}}`. If locked notes are closed, Send asks for their password first. The response shows a secret in the address as `••••`, and Copy as curl writes it as a shell variable, `${GITHUB}`. See [secrets.md](secrets.md).

A request that uses a variable that isn't there, or a response that hasn't come yet, isn't sent: its response says which.

## Sending

In a block, **Send** in its top right corner sends its request; a block of several says **Send all**, and sends each in turn, so later ones can use earlier ones' responses. In a `.http` or `.hurl` note, **Send** is at the end of each request's line. <kbd>⌘↵</kbd> (<kbd>Ctrl+Enter</kbd>) anywhere in a request sends just that one, and <kbd>⌘⇧↵</kbd> sends every request of its block, or note, in turn. Requests are only ever sent by one of those: opening a note sends nothing.

The response shows under the request (under the code block, in a Markdown note): its status, how long it took, its size, and its body, formatted and highlighted when it's JSON, XML or HTML (JSON's objects and arrays fold from the margin), shown when it's an image. Its headers are a tab away. Copy copies the body or the headers; in a Markdown note, **+** adds the body to the note as a code block. In the body:

- **A web address** has Send's icon after it: clicking it adds `GET` and the address to the note as a request, after the one it came from (at the end of its block, in a Markdown note), with that one's headers (its `Authorization`, say), and sends it. Following an API's links this way leaves the trail in the note.
- **A JSON value's line** has a copy button while it's hovered: a string copies without its quotes, an object or array as indented JSON.

 Responses last while lines is open, and aren't saved in the note.

- **In the apps**, requests go through lines' native code, so any API answers, with every header as written, `Cookie` and `Origin` included.
- **In the browser** (the demo website), they're ordinary web requests, so only APIs that allow requests from other sites (CORS) answer, and the browser leaves out headers it doesn't let pages set, such as `Cookie`.

## Hurl

[Hurl](https://hurl.dev) files are entries one after another: a request, and what its response should be. lines reads them itself and sends them as it sends `.http` requests, so they work in the browser too, without the `hurl` program.

```hurl
# Sign in
POST https://api.example.com/login
[Form]
user: ada
password: {{password}}
HTTP 200
[Captures]
token: jsonpath "$.token"

# My profile
GET https://api.example.com/me
Authorization: Bearer {{token}}
HTTP 200
[Asserts]
jsonpath "$.name" == "Ada"
header "Content-Type" contains "json"
duration < 1000
```

- **Requests**: the method and address, headers, then `[Query]` (`[QueryStringParams]`), `[Form]` (`[FormParams]`), `[Cookies]`, `[BasicAuth]` and `[Options]` (`location: true` follows redirects; `variable: name=value`), and a body: JSON, XML, a ```` ``` ```` block (one not closed runs to the end of the note) or a `` `oneline` `` string. JSON and XML bodies are sent with their Content-Type. The comment just above a request is its title, in a `.hurl` note's outline.
- **Responses**: `HTTP 200` (or `HTTP *`), header lines that must match, `[Captures]`, `[Asserts]`, and a body that must match.
- **Queries**: `status`, `url`, `header "…"`, `cookie "…"` (what the response sets, where it can be read), `body`, `bytes`, `jsonpath "…"` ([RFC 9535](https://www.rfc-editor.org/rfc/rfc9535): wildcards, slices, descendants, filters), `xpath "…"`, `regex "…"` or `regex /…/`, `variable "…"`, `duration`, `sha256`.
- **Filters**: `count`, `nth`, `first`, `last`, `regex`, `replace`, `replaceRegex`, `split`, `jsonpath`, `xpath`, `toInt`, `toFloat`, `toString`, `toDate` (ISO 8601), `dateFormat`, `daysAfterNow`, `daysBeforeNow`, `urlDecode`, `urlEncode`, `urlQueryParam`, `htmlEscape`, `htmlUnescape`, `base64Decode`, `base64Encode` (and their URL-safe twins), `toHex`, `utf8Decode`, `utf8Encode`, `charsetDecode`, `location`.
- **Predicates**: `==`, `!=`, `>`, `>=`, `<`, `<=`, `startsWith`, `endsWith`, `contains`, `includes`, `matches`, `exists`, `isBoolean`, `isCollection`, `isDate`, `isEmpty`, `isFloat`, `isInteger`, `isIpv4`, `isIpv6`, `isIsoDate`, `isList`, `isNumber`, `isObject`, `isString`, `isUuid`, each with `not` before it if wanted. Values: `"strings"`, numbers, `true`, `false`, `null`, `/regular expressions/`, `hex,…;`, `base64,…;`, and `{{variables}}`, as their own type.
- **Variables**: what an entry captures, the entries after it use; `{{newUuid}}` and `{{newDate}}` are made up; a name nothing else has is a [secret](secrets.md), as Hurl's `--secret` is.

The response shows how its checks went beside its status (**3 passed**, **1 failed**), and **Checks** lists each, with what the response had when it failed; it opens on Checks when one did. **Send all** stops at the first entry that fails, as Hurl does.

What lines can't do from a fetch, and the `hurl` program can: the HTTP version (`HTTP/2 200` checks the status only, and `version` isn't read), `ip`, `certificate`, `redirects` and `rawbytes`; not following redirects in the browser (the apps can); `[Multipart]`, `file,` bodies, `md5`, GraphQL bodies, and the options that tune curl or repeat entries (`retry`, `delay`, `repeat`, `skip`), which are read and left alone. Entries share no cookie store, as Hurl's do. A check lines can't make says so.

## curl

- **Copy as curl** (Terminal's icon) copies requests as curl commands, with what variables can be filled in filled in: in an `http` block it's in the corner, between Send and Copy, and copies each request in the block; in a `.http` note it's after a request's **Send**, while the line's hovered, and copies that request. Copy copies the block's text as written.
- A curl command pasted into a request (in a `.http` note, or an `http` block), as browsers' "Copy as cURL" and API docs give them, is written as the request it makes: its method, address, headers (`-H`, `-u` as `Authorization`, `-A`, `-b`, `-e`) and body (`-d`, `--data-raw`, `--json`, and `--data-urlencode`, encoded as curl encodes it; `-G` puts it in the address). Short options can run together, the last with its value in the same word, as curl reads them: `-XPUT`, `-sL`, `-H'Accept: …'`. Forms with files (`-F`) and data from a file (`--data-urlencode name@file`) aren't.

## Not yet

- Environments (`http-client.env.json` and its private twin), to switch between a test and a live API. Secrets cover the private part ([secrets.md](secrets.md)).
- Running a whole note, or every Hurl note, as a test suite with a report; running the `hurl` program where it's installed.
- JetBrains' JavaScript response handlers (`> {% … %}`): kept in the text, not run. Saving a response to a file (`>> file`) isn't done either.
- A body read from a file (`< ./body.json`), forms with files, GraphQL and WebSocket requests.
- Plain `http://` to hosts other than this computer: the apps' network permissions allow `https://` and `localhost`.
- Importing and exporting a Bruno collection, Postman's, or an OpenAPI description.
