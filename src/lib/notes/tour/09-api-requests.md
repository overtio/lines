# API requests

An `http` code block holds requests to try an API with, like a lighter Postman or Bruno. Press **Send** in the block's corner, or ⌘↵ with the cursor in a request, and the response shows under the block. Type `/request` to start one.

```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### The person it belongs to
GET {{api}}/users/{{todo.response.body.$.userId}}
```

- An `@api = …` line is a variable, used as `{{api}}` in any block of the note
- `# @name todo` names a request, so the ones after it can use its response. A block of several says **Send all**: it sends **A todo**, then **The person it belongs to** with its answer
- The terminal icon beside Copy, in the block's corner, copies the requests as curl commands, and a curl command pasted into a block becomes a request
- A response's **+** adds its body to the note as a code block

```http
### Make something (this API only pretends to)
POST {{api}}/posts
Content-Type: application/json

{
  "title": "Notes that talk to APIs",
  "userId": 1
}
```

## Follow the links

Many APIs answer with the addresses of more. Send this one, then press the paper plane after an address in the response, the `"url"` of an ability, say: a request to it is written into the block and sent. Hover a line of the response for a button that copies its value.

```http
GET https://pokeapi.co/api/v2/pokemon/ditto
```

## Check the answers

A `hurl` block holds [Hurl](https://hurl.dev) entries: a request, then what its response should be. Send all runs them in order, and a response says how its checks went; **Checks** lists them. A value an entry captures, the next one uses. Type `/hurl` to start one.

```hurl
# Ditto
GET https://pokeapi.co/api/v2/pokemon/ditto
HTTP 200
[Captures]
species: jsonpath "$.species.url"
[Asserts]
jsonpath "$.name" == "ditto"
jsonpath "$.abilities[*].ability.name" includes "limber"
duration < 2000

# Its species, at the address captured above
GET {{species}}
HTTP 200
[Asserts]
jsonpath "$.is_legendary" == false
```

Requests are written in the `.http` format that JetBrains' IDEs, VS Code and Visual Studio read too. A whole note can be requests, as the next one, **Pokédex**, is: switch a note to HTTP Requests in its ⓘ panel, or import a `.http` file.

In the browser, only APIs that allow requests from other sites answer, as these do. The lines app sends to any.

#tour
