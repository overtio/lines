# QA · Everything at the top level

Each element at the top level. Check: it draws as it does on its own, sits inside the container's edges with even space around it, and its Markdown shows while the cursor is in it. Tables, spreadsheets, diagrams and attachments in quotes and list items stay as Markdown.

#qa/containers

#### 1. Paragraph at the top level

A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Long paragraph at the top level

A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Heading 1 at the top level

# Heading one

#### 4. Heading 2 at the top level

## Heading two

#### 5. Heading 3 at the top level

### Heading three

#### 6. Bullet list at the top level

- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Numbered list at the top level

1. First
2. Second
   1. Nested
3. Third

#### 8. Todo list at the top level

- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Quote at the top level

> A quote that runs over
> two lines.

#### 10. Code block at the top level

```
plain code
  indented line
```

#### 11. Code block (TypeScript) at the top level

```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. JSON block (no language) at the top level

```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Diagram at the top level

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Diagram (240 px wide) at the top level

```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Math block at the top level

$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. Table at the top level

| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. Table with formulas at the top level

| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 18. Secret ({{name}}, kept in a locked secrets note) at the top level

The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 19. API requests (http block): a variable, a named request and one using its response at the top level

```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 20. Spreadsheet (csv block) at the top level

```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 21. Named spreadsheet (csv name=), and a formula in another block using it at the top level

```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 22. Divider at the top level

---

#### 23. Key: Value line at the top level

**Wi-Fi password:** correct-horse-battery

#### 24. Mention at the top level

Ask @[QA · Ada] at @[QA · Ada].email.

#### 25. Wiki link at the top level

Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 26. Symbols at the top level

Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 27. GitHub links at the top level

Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 28. Image at the top level

![A sample picture](attachment:photo.png)

#### 29. Drawing at the top level

![A sample drawing](attachment:drawing.svg)

#### 30. File at the top level

[Budget.csv](attachment:budget.csv)

#### 31. Missing file at the top level

[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 32. Card at the top level

::: card
Text in a card.
:::

#### 33. Callout (info) at the top level

:::i
Text in an info callout.
:::

#### 34. Callout (warning, chosen icon) at the top level

:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 35. Callout (decision, no icon) at the top level

:::^ icon=none
Text in a decision callout with no icon.
:::
