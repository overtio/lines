# QA · Right after: Diagram

Diagram followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Diagram, then Paragraph

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Diagram, then Long paragraph

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Diagram, then Heading 1

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
# Heading one

#### 4. Diagram, then Heading 2

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
## Heading two

#### 5. Diagram, then Heading 3

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
### Heading three

#### 6. Diagram, then Bullet list

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Diagram, then Numbered list

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
1. First
2. Second
   1. Nested
3. Third

#### 8. Diagram, then Todo list

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Diagram, then Quote

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
> A quote that runs over
> two lines.

#### 10. Diagram, then Code block

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```
plain code
  indented line
```

#### 11. Diagram, then Code block (TypeScript)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Diagram, then JSON block (no language)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Diagram, then Diagram

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Diagram, then Diagram (240 px wide)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Diagram, then Math block

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. Diagram, then Table

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. Diagram, then Table with formulas

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 18. Diagram, then Spreadsheet (csv block)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 19. Diagram, then Divider

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
---

#### 20. Diagram, then Key: Value line

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
**Wi-Fi password:** correct-horse-battery

#### 21. Diagram, then Mention

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Ask @[QA · Ada] at @[QA · Ada].email.

#### 22. Diagram, then Wiki link

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 23. Diagram, then Symbols

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 24. Diagram, then GitHub links

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 25. Diagram, then Image

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
![A sample picture](attachment:photo.png)

#### 26. Diagram, then Drawing

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
![A sample drawing](attachment:drawing.svg)

#### 27. Diagram, then File

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
[Budget.csv](attachment:budget.csv)

#### 28. Diagram, then Missing file

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 29. Diagram, then Card

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
::: card
Text in a card.
:::

#### 30. Diagram, then Callout (info)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
:::i
Text in an info callout.
:::

#### 31. Diagram, then Callout (warning, chosen icon)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 32. Diagram, then Callout (decision, no icon)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
:::^ icon=none
Text in a decision callout with no icon.
:::
