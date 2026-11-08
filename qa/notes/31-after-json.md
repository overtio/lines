# QA · Right after: JSON block (no language)

JSON block (no language) followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. JSON block (no language), then Paragraph

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. JSON block (no language), then Long paragraph

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. JSON block (no language), then Heading 1

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
# Heading one

#### 4. JSON block (no language), then Heading 2

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
## Heading two

#### 5. JSON block (no language), then Heading 3

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
### Heading three

#### 6. JSON block (no language), then Bullet list

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. JSON block (no language), then Numbered list

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
1. First
2. Second
   1. Nested
3. Third

#### 8. JSON block (no language), then Todo list

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. JSON block (no language), then Quote

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
> A quote that runs over
> two lines.

#### 10. JSON block (no language), then Code block

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
```
plain code
  indented line
```

#### 11. JSON block (no language), then Code block (TypeScript)

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. JSON block (no language), then JSON block (no language)

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. JSON block (no language), then Diagram

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. JSON block (no language), then Diagram (240 px wide)

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. JSON block (no language), then Math block

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. JSON block (no language), then Table

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. JSON block (no language), then Table with formulas

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 18. JSON block (no language), then Secret ({{name}}, kept in a locked secrets note)

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 19. JSON block (no language), then API requests (http block): a variable, a named request and one using its response

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 20. JSON block (no language), then Spreadsheet (csv block)

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 21. JSON block (no language), then Named spreadsheet (csv name=), and a formula in another block using it

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 22. JSON block (no language), then Divider

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
---

#### 23. JSON block (no language), then Key: Value line

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
**Wi-Fi password:** correct-horse-battery

#### 24. JSON block (no language), then Mention

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
Ask @[QA · Ada] at @[QA · Ada].email.

#### 25. JSON block (no language), then Wiki link

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 26. JSON block (no language), then Symbols

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 27. JSON block (no language), then GitHub links

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 28. JSON block (no language), then Image

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
![A sample picture](attachment:photo.png)

#### 29. JSON block (no language), then Drawing

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
![A sample drawing](attachment:drawing.svg)

#### 30. JSON block (no language), then File

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
[Budget.csv](attachment:budget.csv)

#### 31. JSON block (no language), then Missing file

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 32. JSON block (no language), then Card

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
::: card
Text in a card.
:::

#### 33. JSON block (no language), then Callout (info)

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
:::i
Text in an info callout.
:::

#### 34. JSON block (no language), then Callout (warning, chosen icon)

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 35. JSON block (no language), then Callout (decision, no icon)

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
:::^ icon=none
Text in a decision callout with no icon.
:::
