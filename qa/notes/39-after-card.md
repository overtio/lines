# QA · Right after: Card

Card followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Card, then Paragraph

::: card
Text in a card.
:::
A paragraph with **bold**, *italic*, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Card, then Long paragraph

::: card
Text in a card.
:::
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Card, then Heading 1

::: card
Text in a card.
:::
# Heading one

#### 4. Card, then Heading 2

::: card
Text in a card.
:::
## Heading two

#### 5. Card, then Heading 3

::: card
Text in a card.
:::
### Heading three

#### 6. Card, then Bullet list

::: card
Text in a card.
:::
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Card, then Numbered list

::: card
Text in a card.
:::
1. First
2. Second
   1. Nested
3. Third

#### 8. Card, then Todo list

::: card
Text in a card.
:::
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Card, then Quote

::: card
Text in a card.
:::
> A quote that runs over
> two lines.

#### 10. Card, then Code block

::: card
Text in a card.
:::
```
plain code
  indented line
```

#### 11. Card, then Code block (TypeScript)

::: card
Text in a card.
:::
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Card, then JSON block (no language)

::: card
Text in a card.
:::
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Card, then Diagram

::: card
Text in a card.
:::
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Card, then Table

::: card
Text in a card.
:::
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 15. Card, then Divider

::: card
Text in a card.
:::
---

#### 16. Card, then Key: Value line

::: card
Text in a card.
:::
**Wi-Fi password:** correct-horse-battery

#### 17. Card, then Image

::: card
Text in a card.
:::
![A sample picture](attachment:photo.png)

#### 18. Card, then File

::: card
Text in a card.
:::
[Budget.csv](attachment:budget.csv)

#### 19. Card, then Missing file

::: card
Text in a card.
:::
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 20. Card, then Card

::: card
Text in a card.
:::
::: card
Text in a card.
:::

#### 21. Card, then Callout (info)

::: card
Text in a card.
:::
:::i
Text in an info callout.
:::

#### 22. Card, then Callout (warning, chosen icon)

::: card
Text in a card.
:::
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 23. Card, then Callout (decision, no icon)

::: card
Text in a card.
:::
:::^ icon=none
Text in a decision callout with no icon.
:::
