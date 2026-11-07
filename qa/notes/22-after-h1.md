# QA · Right after: Heading 1

Heading 1 followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Heading 1, then Paragraph

# Heading one
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Heading 1, then Long paragraph

# Heading one
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Heading 1, then Heading 1

# Heading one
# Heading one

#### 4. Heading 1, then Heading 2

# Heading one
## Heading two

#### 5. Heading 1, then Heading 3

# Heading one
### Heading three

#### 6. Heading 1, then Bullet list

# Heading one
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Heading 1, then Numbered list

# Heading one
1. First
2. Second
   1. Nested
3. Third

#### 8. Heading 1, then Todo list

# Heading one
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Heading 1, then Quote

# Heading one
> A quote that runs over
> two lines.

#### 10. Heading 1, then Code block

# Heading one
```
plain code
  indented line
```

#### 11. Heading 1, then Code block (TypeScript)

# Heading one
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Heading 1, then JSON block (no language)

# Heading one
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Heading 1, then Diagram

# Heading one
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Heading 1, then Diagram (240 px wide)

# Heading one
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Heading 1, then Math block

# Heading one
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. Heading 1, then Table

# Heading one
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. Heading 1, then Table with formulas

# Heading one
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 18. Heading 1, then API requests (http block): a variable, a named request and one using its response

# Heading one
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 19. Heading 1, then Spreadsheet (csv block)

# Heading one
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 20. Heading 1, then Named spreadsheet (csv name=), and a formula in another block using it

# Heading one
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 21. Heading 1, then Divider

# Heading one
---

#### 22. Heading 1, then Key: Value line

# Heading one
**Wi-Fi password:** correct-horse-battery

#### 23. Heading 1, then Mention

# Heading one
Ask @[QA · Ada] at @[QA · Ada].email.

#### 24. Heading 1, then Wiki link

# Heading one
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 25. Heading 1, then Symbols

# Heading one
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 26. Heading 1, then GitHub links

# Heading one
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 27. Heading 1, then Image

# Heading one
![A sample picture](attachment:photo.png)

#### 28. Heading 1, then Drawing

# Heading one
![A sample drawing](attachment:drawing.svg)

#### 29. Heading 1, then File

# Heading one
[Budget.csv](attachment:budget.csv)

#### 30. Heading 1, then Missing file

# Heading one
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 31. Heading 1, then Card

# Heading one
::: card
Text in a card.
:::

#### 32. Heading 1, then Callout (info)

# Heading one
:::i
Text in an info callout.
:::

#### 33. Heading 1, then Callout (warning, chosen icon)

# Heading one
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 34. Heading 1, then Callout (decision, no icon)

# Heading one
:::^ icon=none
Text in a decision callout with no icon.
:::
