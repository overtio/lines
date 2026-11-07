# API requests

An `http` code block holds requests to try an API with, like a lighter Postman or Bruno. Press **Send** at the end of a request's line, or ⌘↵ with the cursor in it, and the response shows under the block. Type `/request` to start one.

```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### The person it belongs to
GET {{api}}/users/{{todo.response.body.$.userId}}
```

- An `@api = …` line is a variable, used as `{{api}}` in any block of the note
- `# @name todo` names a request, so the ones after it can use its response: send **A todo**, then **The person it belongs to**
- Paste a curl command into a block and it becomes a request; **curl** after **Send** copies a request as a curl command
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

Requests are written in the `.http` format that JetBrains' IDEs, VS Code and Visual Studio read too. A whole note can be requests: switch it to HTTP Requests in its ⓘ panel, or import a `.http` file.

In the browser, only APIs that allow requests from other sites answer, as this one does. The lines app sends to any.
