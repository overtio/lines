# QA · Right after: File

File followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. File, then Paragraph

[Budget.csv](attachment:budget.csv)
A paragraph with **bold**, *italic*, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. File, then Long paragraph

[Budget.csv](attachment:budget.csv)
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. File, then Heading 1

[Budget.csv](attachment:budget.csv)
# Heading one

#### 4. File, then Heading 2

[Budget.csv](attachment:budget.csv)
## Heading two

#### 5. File, then Heading 3

[Budget.csv](attachment:budget.csv)
### Heading three

#### 6. File, then Bullet list

[Budget.csv](attachment:budget.csv)
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. File, then Numbered list

[Budget.csv](attachment:budget.csv)
1. First
2. Second
   1. Nested
3. Third

#### 8. File, then Todo list

[Budget.csv](attachment:budget.csv)
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. File, then Quote

[Budget.csv](attachment:budget.csv)
> A quote that runs over
> two lines.

#### 10. File, then Code block

[Budget.csv](attachment:budget.csv)
```
plain code
  indented line
```

#### 11. File, then Code block (TypeScript)

[Budget.csv](attachment:budget.csv)
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. File, then JSON block (no language)

[Budget.csv](attachment:budget.csv)
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. File, then Diagram

[Budget.csv](attachment:budget.csv)
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. File, then Diagram (240 px wide)

[Budget.csv](attachment:budget.csv)
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. File, then Math block

[Budget.csv](attachment:budget.csv)
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 16. File, then Table

[Budget.csv](attachment:budget.csv)
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 17. File, then Divider

[Budget.csv](attachment:budget.csv)
---

#### 18. File, then Key: Value line

[Budget.csv](attachment:budget.csv)
**Wi-Fi password:** correct-horse-battery

#### 19. File, then Mention

[Budget.csv](attachment:budget.csv)
Ask @[QA · Ada] at @[QA · Ada].email.

#### 20. File, then Wiki link

[Budget.csv](attachment:budget.csv)
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 21. File, then Symbols

[Budget.csv](attachment:budget.csv)
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 22. File, then GitHub links

[Budget.csv](attachment:budget.csv)
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 23. File, then Image

[Budget.csv](attachment:budget.csv)
![A sample picture](attachment:photo.png)

#### 24. File, then Drawing

[Budget.csv](attachment:budget.csv)
![A sample drawing](attachment:drawing.svg)

#### 25. File, then File

[Budget.csv](attachment:budget.csv)
[Budget.csv](attachment:budget.csv)

#### 26. File, then Missing file

[Budget.csv](attachment:budget.csv)
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 27. File, then Card

[Budget.csv](attachment:budget.csv)
::: card
Text in a card.
:::

#### 28. File, then Callout (info)

[Budget.csv](attachment:budget.csv)
:::i
Text in an info callout.
:::

#### 29. File, then Callout (warning, chosen icon)

[Budget.csv](attachment:budget.csv)
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 30. File, then Callout (decision, no icon)

[Budget.csv](attachment:budget.csv)
:::^ icon=none
Text in a decision callout with no icon.
:::
