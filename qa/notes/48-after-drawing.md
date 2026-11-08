# QA · Right after: Drawing

Drawing followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Drawing, then Paragraph

![A sample drawing](attachment:drawing.svg)
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Drawing, then Long paragraph

![A sample drawing](attachment:drawing.svg)
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Drawing, then Heading 1

![A sample drawing](attachment:drawing.svg)
# Heading one

#### 4. Drawing, then Heading 2

![A sample drawing](attachment:drawing.svg)
## Heading two

#### 5. Drawing, then Heading 3

![A sample drawing](attachment:drawing.svg)
### Heading three

#### 6. Drawing, then Bullet list

![A sample drawing](attachment:drawing.svg)
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Drawing, then Numbered list

![A sample drawing](attachment:drawing.svg)
1. First
2. Second
   1. Nested
3. Third

#### 8. Drawing, then Todo list

![A sample drawing](attachment:drawing.svg)
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Drawing, then Quote

![A sample drawing](attachment:drawing.svg)
> A quote that runs over
> two lines.

#### 10. Drawing, then Code block

![A sample drawing](attachment:drawing.svg)
```
plain code
  indented line
```

#### 11. Drawing, then Code block (TypeScript)

![A sample drawing](attachment:drawing.svg)
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Drawing, then JSON block (no language)

![A sample drawing](attachment:drawing.svg)
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Drawing, then Diagram

![A sample drawing](attachment:drawing.svg)
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Drawing, then Diagram (240 px wide)

![A sample drawing](attachment:drawing.svg)
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Drawing, then Math block

![A sample drawing](attachment:drawing.svg)
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. Drawing, then Table

![A sample drawing](attachment:drawing.svg)
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. Drawing, then Table with formulas

![A sample drawing](attachment:drawing.svg)
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 18. Drawing, then Secret ({{name}}, kept in a locked secrets note)

![A sample drawing](attachment:drawing.svg)
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 19. Drawing, then API requests (http block): a variable, a named request and one using its response

![A sample drawing](attachment:drawing.svg)
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 20. Drawing, then Spreadsheet (csv block)

![A sample drawing](attachment:drawing.svg)
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 21. Drawing, then Named spreadsheet (csv name=), and a formula in another block using it

![A sample drawing](attachment:drawing.svg)
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 22. Drawing, then Divider

![A sample drawing](attachment:drawing.svg)
---

#### 23. Drawing, then Key: Value line

![A sample drawing](attachment:drawing.svg)
**Wi-Fi password:** correct-horse-battery

#### 24. Drawing, then Mention

![A sample drawing](attachment:drawing.svg)
Ask @[QA · Ada] at @[QA · Ada].email.

#### 25. Drawing, then Wiki link

![A sample drawing](attachment:drawing.svg)
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 26. Drawing, then Symbols

![A sample drawing](attachment:drawing.svg)
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 27. Drawing, then GitHub links

![A sample drawing](attachment:drawing.svg)
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 28. Drawing, then Image

![A sample drawing](attachment:drawing.svg)
![A sample picture](attachment:photo.png)

#### 29. Drawing, then Drawing

![A sample drawing](attachment:drawing.svg)
![A sample drawing](attachment:drawing.svg)

#### 30. Drawing, then File

![A sample drawing](attachment:drawing.svg)
[Budget.csv](attachment:budget.csv)

#### 31. Drawing, then Missing file

![A sample drawing](attachment:drawing.svg)
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 32. Drawing, then Card

![A sample drawing](attachment:drawing.svg)
::: card
Text in a card.
:::

#### 33. Drawing, then Callout (info)

![A sample drawing](attachment:drawing.svg)
:::i
Text in an info callout.
:::

#### 34. Drawing, then Callout (warning, chosen icon)

![A sample drawing](attachment:drawing.svg)
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 35. Drawing, then Callout (decision, no icon)

![A sample drawing](attachment:drawing.svg)
:::^ icon=none
Text in a decision callout with no icon.
:::
