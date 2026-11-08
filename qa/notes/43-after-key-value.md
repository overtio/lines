# QA · Right after: Key: Value line

Key: Value line followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Key: Value line, then Paragraph

**Wi-Fi password:** correct-horse-battery
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Key: Value line, then Long paragraph

**Wi-Fi password:** correct-horse-battery
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Key: Value line, then Heading 1

**Wi-Fi password:** correct-horse-battery
# Heading one

#### 4. Key: Value line, then Heading 2

**Wi-Fi password:** correct-horse-battery
## Heading two

#### 5. Key: Value line, then Heading 3

**Wi-Fi password:** correct-horse-battery
### Heading three

#### 6. Key: Value line, then Bullet list

**Wi-Fi password:** correct-horse-battery
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Key: Value line, then Numbered list

**Wi-Fi password:** correct-horse-battery
1. First
2. Second
   1. Nested
3. Third

#### 8. Key: Value line, then Todo list

**Wi-Fi password:** correct-horse-battery
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Key: Value line, then Quote

**Wi-Fi password:** correct-horse-battery
> A quote that runs over
> two lines.

#### 10. Key: Value line, then Code block

**Wi-Fi password:** correct-horse-battery
```
plain code
  indented line
```

#### 11. Key: Value line, then Code block (TypeScript)

**Wi-Fi password:** correct-horse-battery
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Key: Value line, then JSON block (no language)

**Wi-Fi password:** correct-horse-battery
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Key: Value line, then Diagram

**Wi-Fi password:** correct-horse-battery
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Key: Value line, then Diagram (240 px wide)

**Wi-Fi password:** correct-horse-battery
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Key: Value line, then Math block

**Wi-Fi password:** correct-horse-battery
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. Key: Value line, then Table

**Wi-Fi password:** correct-horse-battery
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. Key: Value line, then Table with formulas

**Wi-Fi password:** correct-horse-battery
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 18. Key: Value line, then Hurl entries (hurl block): a capture used by the next entry, and asserts

**Wi-Fi password:** correct-horse-battery
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

#### 19. Key: Value line, then Secret ({{name}}, kept in a locked secrets note)

**Wi-Fi password:** correct-horse-battery
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 20. Key: Value line, then API requests (http block): a variable, a named request and one using its response

**Wi-Fi password:** correct-horse-battery
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 21. Key: Value line, then Spreadsheet (csv block)

**Wi-Fi password:** correct-horse-battery
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 22. Key: Value line, then Named spreadsheet (csv name=), and a formula in another block using it

**Wi-Fi password:** correct-horse-battery
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 23. Key: Value line, then Divider

**Wi-Fi password:** correct-horse-battery
---

#### 24. Key: Value line, then Key: Value line

**Wi-Fi password:** correct-horse-battery
**Wi-Fi password:** correct-horse-battery

#### 25. Key: Value line, then Mention

**Wi-Fi password:** correct-horse-battery
Ask @[QA · Ada] at @[QA · Ada].email.

#### 26. Key: Value line, then Wiki link

**Wi-Fi password:** correct-horse-battery
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 27. Key: Value line, then Symbols

**Wi-Fi password:** correct-horse-battery
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 28. Key: Value line, then GitHub links

**Wi-Fi password:** correct-horse-battery
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 29. Key: Value line, then Image

**Wi-Fi password:** correct-horse-battery
![A sample picture](attachment:photo.png)

#### 30. Key: Value line, then Drawing

**Wi-Fi password:** correct-horse-battery
![A sample drawing](attachment:drawing.svg)

#### 31. Key: Value line, then File

**Wi-Fi password:** correct-horse-battery
[Budget.csv](attachment:budget.csv)

#### 32. Key: Value line, then Missing file

**Wi-Fi password:** correct-horse-battery
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 33. Key: Value line, then Card

**Wi-Fi password:** correct-horse-battery
::: card
Text in a card.
:::

#### 34. Key: Value line, then Callout (info)

**Wi-Fi password:** correct-horse-battery
:::i
Text in an info callout.
:::

#### 35. Key: Value line, then Callout (warning, chosen icon)

**Wi-Fi password:** correct-horse-battery
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 36. Key: Value line, then Callout (decision, no icon)

**Wi-Fi password:** correct-horse-battery
:::^ icon=none
Text in a decision callout with no icon.
:::
