# QA · Right after: Numbered list

Numbered list followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Numbered list, then Paragraph

1. First
2. Second
   1. Nested
3. Third
A paragraph with **bold**, *italic*, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Numbered list, then Long paragraph

1. First
2. Second
   1. Nested
3. Third
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Numbered list, then Heading 1

1. First
2. Second
   1. Nested
3. Third
# Heading one

#### 4. Numbered list, then Heading 2

1. First
2. Second
   1. Nested
3. Third
## Heading two

#### 5. Numbered list, then Heading 3

1. First
2. Second
   1. Nested
3. Third
### Heading three

#### 6. Numbered list, then Bullet list

1. First
2. Second
   1. Nested
3. Third
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Numbered list, then Numbered list

1. First
2. Second
   1. Nested
3. Third
1. First
2. Second
   1. Nested
3. Third

#### 8. Numbered list, then Todo list

1. First
2. Second
   1. Nested
3. Third
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Numbered list, then Quote

1. First
2. Second
   1. Nested
3. Third
> A quote that runs over
> two lines.

#### 10. Numbered list, then Code block

1. First
2. Second
   1. Nested
3. Third
```
plain code
  indented line
```

#### 11. Numbered list, then Code block (TypeScript)

1. First
2. Second
   1. Nested
3. Third
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Numbered list, then JSON block (no language)

1. First
2. Second
   1. Nested
3. Third
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Numbered list, then Diagram

1. First
2. Second
   1. Nested
3. Third
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Numbered list, then Table

1. First
2. Second
   1. Nested
3. Third
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 15. Numbered list, then Divider

1. First
2. Second
   1. Nested
3. Third
---

#### 16. Numbered list, then Key: Value line

1. First
2. Second
   1. Nested
3. Third
**Wi-Fi password:** correct-horse-battery

#### 17. Numbered list, then Image

1. First
2. Second
   1. Nested
3. Third
![A sample picture](attachment:photo.png)

#### 18. Numbered list, then File

1. First
2. Second
   1. Nested
3. Third
[Budget.csv](attachment:budget.csv)

#### 19. Numbered list, then Missing file

1. First
2. Second
   1. Nested
3. Third
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 20. Numbered list, then Card

1. First
2. Second
   1. Nested
3. Third
::: card
Text in a card.
:::

#### 21. Numbered list, then Callout (info)

1. First
2. Second
   1. Nested
3. Third
:::i
Text in an info callout.
:::

#### 22. Numbered list, then Callout (warning, chosen icon)

1. First
2. Second
   1. Nested
3. Third
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 23. Numbered list, then Callout (decision, no icon)

1. First
2. Second
   1. Nested
3. Third
:::^ icon=none
Text in a decision callout with no icon.
:::
