# QA · Everything in a card

Each element in a card. Check: it draws as it does on its own, sits inside the container's edges with even space around it, and its Markdown shows while the cursor is in it. Tables, spreadsheets, diagrams and attachments in quotes and list items stay as Markdown.

#qa/containers

#### 1. Paragraph in a card

::: card
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.
:::

#### 2. Long paragraph in a card

::: card
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.
:::

#### 3. Heading 1 in a card

::: card
# Heading one
:::

#### 4. Heading 2 in a card

::: card
## Heading two
:::

#### 5. Heading 3 in a card

::: card
### Heading three
:::

#### 6. Bullet list in a card

::: card
- First item
- Second item
  - Nested item
    - Third level
- Last item
:::

#### 7. Numbered list in a card

::: card
1. First
2. Second
   1. Nested
3. Third
:::

#### 8. Todo list in a card

::: card
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo
:::

#### 9. Quote in a card

::: card
> A quote that runs over
> two lines.
:::

#### 10. Code block in a card

::: card
```
plain code
  indented line
```
:::

#### 11. Code block (TypeScript) in a card

::: card
```ts
const greeting: string = "hello";
console.log(greeting);
```
:::

#### 12. JSON block (no language) in a card

::: card
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
:::

#### 13. Diagram in a card

::: card
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
:::

#### 14. Diagram (240 px wide) in a card

::: card
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```
:::

#### 15. Math block in a card

::: card
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$
:::

#### 16. Table in a card

::: card
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |
:::

#### 17. Table with formulas in a card

::: card
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |
:::

#### 18. Spreadsheet (csv block) in a card

::: card
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```
:::

#### 19. Named spreadsheet (csv name=), and a formula in another block using it in a card

::: card
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```
:::

#### 20. Divider in a card

::: card
---
:::

#### 21. Key: Value line in a card

::: card
**Wi-Fi password:** correct-horse-battery
:::

#### 22. Mention in a card

::: card
Ask @[QA · Ada] at @[QA · Ada].email.
:::

#### 23. Wiki link in a card

::: card
Ask [[QA · Ada]], or [[QA · Ada|her]].
:::

#### 24. Symbols in a card

::: card
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.
:::

#### 25. GitHub links in a card

::: card
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)
:::

#### 26. Image in a card

::: card
![A sample picture](attachment:photo.png)
:::

#### 27. Drawing in a card

::: card
![A sample drawing](attachment:drawing.svg)
:::

#### 28. File in a card

::: card
[Budget.csv](attachment:budget.csv)
:::

#### 29. Missing file in a card

::: card
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)
:::

#### 30. Card in a card

::: card
::: card
Text in a card.
:::
:::

#### 31. Callout (info) in a card

::: card
:::i
Text in an info callout.
:::
:::

#### 32. Callout (warning, chosen icon) in a card

::: card
:::! icon=flag
Text in a warning callout with the flag icon.
:::
:::

#### 33. Callout (decision, no icon) in a card

::: card
:::^ icon=none
Text in a decision callout with no icon.
:::
:::
