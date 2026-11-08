# QA · Right after: Wiki link

Wiki link followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Wiki link, then Paragraph

Ask [[QA · Ada]], or [[QA · Ada|her]].
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Wiki link, then Long paragraph

Ask [[QA · Ada]], or [[QA · Ada|her]].
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Wiki link, then Heading 1

Ask [[QA · Ada]], or [[QA · Ada|her]].
# Heading one

#### 4. Wiki link, then Heading 2

Ask [[QA · Ada]], or [[QA · Ada|her]].
## Heading two

#### 5. Wiki link, then Heading 3

Ask [[QA · Ada]], or [[QA · Ada|her]].
### Heading three

#### 6. Wiki link, then Bullet list

Ask [[QA · Ada]], or [[QA · Ada|her]].
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Wiki link, then Numbered list

Ask [[QA · Ada]], or [[QA · Ada|her]].
1. First
2. Second
   1. Nested
3. Third

#### 8. Wiki link, then Todo list

Ask [[QA · Ada]], or [[QA · Ada|her]].
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Wiki link, then Quote

Ask [[QA · Ada]], or [[QA · Ada|her]].
> A quote that runs over
> two lines.

#### 10. Wiki link, then Code block

Ask [[QA · Ada]], or [[QA · Ada|her]].
```
plain code
  indented line
```

#### 11. Wiki link, then Code block (TypeScript)

Ask [[QA · Ada]], or [[QA · Ada|her]].
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Wiki link, then JSON block (no language)

Ask [[QA · Ada]], or [[QA · Ada|her]].
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Wiki link, then Diagram

Ask [[QA · Ada]], or [[QA · Ada|her]].
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Wiki link, then Diagram (240 px wide)

Ask [[QA · Ada]], or [[QA · Ada|her]].
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Wiki link, then Math block

Ask [[QA · Ada]], or [[QA · Ada|her]].
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. Wiki link, then Table

Ask [[QA · Ada]], or [[QA · Ada|her]].
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. Wiki link, then Table with formulas

Ask [[QA · Ada]], or [[QA · Ada|her]].
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 18. Wiki link, then Hurl entries (hurl block): a capture used by the next entry, and asserts

Ask [[QA · Ada]], or [[QA · Ada|her]].
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

#### 19. Wiki link, then Secret ({{name}}, kept in a locked secrets note)

Ask [[QA · Ada]], or [[QA · Ada|her]].
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 20. Wiki link, then API requests (http block): a variable, a named request and one using its response

Ask [[QA · Ada]], or [[QA · Ada|her]].
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 21. Wiki link, then Spreadsheet (csv block)

Ask [[QA · Ada]], or [[QA · Ada|her]].
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 22. Wiki link, then Named spreadsheet (csv name=), and a formula in another block using it

Ask [[QA · Ada]], or [[QA · Ada|her]].
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 23. Wiki link, then Divider

Ask [[QA · Ada]], or [[QA · Ada|her]].
---

#### 24. Wiki link, then Key: Value line

Ask [[QA · Ada]], or [[QA · Ada|her]].
**Wi-Fi password:** correct-horse-battery

#### 25. Wiki link, then Mention

Ask [[QA · Ada]], or [[QA · Ada|her]].
Ask @[QA · Ada] at @[QA · Ada].email.

#### 26. Wiki link, then Wiki link

Ask [[QA · Ada]], or [[QA · Ada|her]].
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 27. Wiki link, then Symbols

Ask [[QA · Ada]], or [[QA · Ada|her]].
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 28. Wiki link, then GitHub links

Ask [[QA · Ada]], or [[QA · Ada|her]].
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 29. Wiki link, then Image

Ask [[QA · Ada]], or [[QA · Ada|her]].
![A sample picture](attachment:photo.png)

#### 30. Wiki link, then Drawing

Ask [[QA · Ada]], or [[QA · Ada|her]].
![A sample drawing](attachment:drawing.svg)

#### 31. Wiki link, then File

Ask [[QA · Ada]], or [[QA · Ada|her]].
[Budget.csv](attachment:budget.csv)

#### 32. Wiki link, then Missing file

Ask [[QA · Ada]], or [[QA · Ada|her]].
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 33. Wiki link, then Card

Ask [[QA · Ada]], or [[QA · Ada|her]].
::: card
Text in a card.
:::

#### 34. Wiki link, then Callout (info)

Ask [[QA · Ada]], or [[QA · Ada|her]].
:::i
Text in an info callout.
:::

#### 35. Wiki link, then Callout (warning, chosen icon)

Ask [[QA · Ada]], or [[QA · Ada|her]].
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 36. Wiki link, then Callout (decision, no icon)

Ask [[QA · Ada]], or [[QA · Ada|her]].
:::^ icon=none
Text in a decision callout with no icon.
:::
