# QA · Right after: Divider

Divider followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Divider, then Paragraph

---
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Divider, then Long paragraph

---
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Divider, then Heading 1

---
# Heading one

#### 4. Divider, then Heading 2

---
## Heading two

#### 5. Divider, then Heading 3

---
### Heading three

#### 6. Divider, then Bullet list

---
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Divider, then Numbered list

---
1. First
2. Second
   1. Nested
3. Third

#### 8. Divider, then Todo list

---
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Divider, then Quote

---
> A quote that runs over
> two lines.

#### 10. Divider, then Code block

---
```
plain code
  indented line
```

#### 11. Divider, then Code block (TypeScript)

---
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Divider, then JSON block (no language)

---
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Divider, then Diagram

---
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Divider, then Diagram (240 px wide)

---
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Divider, then Math block

---
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. Divider, then Table

---
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. Divider, then Table with formulas

---
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 18. Divider, then Hurl entries (hurl block): a capture used by the next entry, and asserts

---
```hurl
# A todo
GET https://jsonplaceholder.typicode.com/todos/1
HTTP 200
[Captures]
owner: jsonpath "$.userId"
[Asserts]
jsonpath "$.id" == 1

# Its owner
GET https://jsonplaceholder.typicode.com/users/{{owner}}
HTTP 200
[Asserts]
jsonpath "$.name" isString
```

#### 19. Divider, then Secret ({{name}}, kept in a locked secrets note)

---
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 20. Divider, then API requests (http block): a variable, a named request and one using its response

---
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 21. Divider, then Spreadsheet (csv block)

---
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 22. Divider, then Named spreadsheet (csv name=), and a formula in another block using it

---
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 23. Divider, then Divider

---
---

#### 24. Divider, then Key: Value line

---
**Wi-Fi password:** correct-horse-battery

#### 25. Divider, then Mention

---
Ask @[QA · Ada] at @[QA · Ada].email.

#### 26. Divider, then Wiki link

---
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 27. Divider, then Symbols

---
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 28. Divider, then GitHub links

---
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 29. Divider, then Image

---
![A sample picture](attachment:photo.png)

#### 30. Divider, then Drawing

---
![A sample drawing](attachment:drawing.svg)

#### 31. Divider, then File

---
[Budget.csv](attachment:budget.csv)

#### 32. Divider, then Missing file

---
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 33. Divider, then Card

---
::: card
Text in a card.
:::

#### 34. Divider, then Callout (info)

---
:::i
Text in an info callout.
:::

#### 35. Divider, then Callout (warning, chosen icon)

---
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 36. Divider, then Callout (decision, no icon)

---
:::^ icon=none
Text in a decision callout with no icon.
:::
