# QA · Everything in a quote

Each element in a quote. Check: it draws as it does on its own, sits inside the container's edges with even space around it, and its Markdown shows while the cursor is in it. Tables, spreadsheets, diagrams and attachments in quotes and list items stay as Markdown.

#qa/containers

#### 1. Paragraph in a quote

> A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Long paragraph in a quote

> A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Heading 1 in a quote

> # Heading one

#### 4. Heading 2 in a quote

> ## Heading two

#### 5. Heading 3 in a quote

> ### Heading three

#### 6. Bullet list in a quote

> - First item
> - Second item
>   - Nested item
>     - Third level
> - Last item

#### 7. Numbered list in a quote

> 1. First
> 2. Second
>    1. Nested
> 3. Third

#### 8. Todo list in a quote

> - [x] Done todo
> - [ ] Open todo
>   - [ ] Nested open todo

#### 9. Quote in a quote

> > A quote that runs over
> > two lines.

#### 10. Code block in a quote

> ```
> plain code
>   indented line
> ```

#### 11. Code block (TypeScript) in a quote

> ```ts
> const greeting: string = "hello";
> console.log(greeting);
> ```

#### 12. JSON block (no language) in a quote

> ```
> {"name":"lines","tags":["a","b"],"id":12345678901234567890}
> ```

#### 13. Diagram in a quote (stays Markdown here)

> ```mermaid
> flowchart LR
>   A[Start] --> B{Choice}
>   B --> C[Done]
> ```

#### 14. Diagram (240 px wide) in a quote (stays Markdown here)

> ```mermaid |240
> flowchart LR
>   A[Small] --> B[Diagram]
> ```

#### 15. Math block in a quote (stays Markdown here)

> $$
> \int_0^1 x^2\,dx = \frac{1}{3}
> $$

#### 16. Table in a quote (stays Markdown here)

> | Left | Center | Right |
> | :--- | :----: | ----: |
> | a | **b** | 1 |
> | longer cell text | `code` | 22 |

#### 17. Table with formulas in a quote (stays Markdown here)

> | Item | Cost |
> | --- | ---: |
> | Rent | 1200 |
> | Food | 450.50 |
> | Total | =SUM(B2:B3) |
> | Broken | =B2/0 |

#### 18. API requests (http block): a variable, a named request and one using its response in a quote

> ```http
> @api = https://jsonplaceholder.typicode.com
>
> ### A todo
> # @name todo
> GET {{api}}/todos/1
>
> ### Its owner
> GET {{api}}/users/{{todo.response.body.$.userId}}
> ```

#### 19. Spreadsheet (csv block) in a quote (stays Markdown here)

> ```csv
> Item, Cost
> Rent, 1200
> Food, 450.50
> Total, =SUM(B2:B3)
> ```

#### 20. Named spreadsheet (csv name=), and a formula in another block using it in a quote (stays Markdown here)

> ```csv name=costs
> Item, Cost, Day
> Rent, $1200, 2026-01-05
> ```
>
> ```csv
> Total, =costs!B2*2
> ```

#### 21. Divider in a quote

> ---

#### 22. Key: Value line in a quote

> **Wi-Fi password:** correct-horse-battery

#### 23. Mention in a quote

> Ask @[QA · Ada] at @[QA · Ada].email.

#### 24. Wiki link in a quote

> Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 25. Symbols in a quote

> Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 26. GitHub links in a quote

> Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 27. Image in a quote (stays Markdown here)

> ![A sample picture](attachment:photo.png)

#### 28. Drawing in a quote (stays Markdown here)

> ![A sample drawing](attachment:drawing.svg)

#### 29. File in a quote (stays Markdown here)

> [Budget.csv](attachment:budget.csv)

#### 30. Missing file in a quote (stays Markdown here)

> [Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 31. Card in a quote

> ::: card
> Text in a card.
> :::

#### 32. Callout (info) in a quote

> :::i
> Text in an info callout.
> :::

#### 33. Callout (warning, chosen icon) in a quote

> :::! icon=flag
> Text in a warning callout with the flag icon.
> :::

#### 34. Callout (decision, no icon) in a quote

> :::^ icon=none
> Text in a decision callout with no icon.
> :::
