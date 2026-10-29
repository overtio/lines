# QA · Everything in a callout with no icon

Each element in a callout with no icon. Check: it draws as it does on its own, sits inside the container's edges with even space around it, and its Markdown shows while the cursor is in it. Tables, diagrams and attachments in quotes and list items stay as Markdown.

#qa/containers

#### 1. Paragraph in a callout with no icon

:::^ icon=none
A paragraph with **bold**, *italic*, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.
:::

#### 2. Long paragraph in a callout with no icon

:::^ icon=none
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.
:::

#### 3. Heading 1 in a callout with no icon

:::^ icon=none
# Heading one
:::

#### 4. Heading 2 in a callout with no icon

:::^ icon=none
## Heading two
:::

#### 5. Heading 3 in a callout with no icon

:::^ icon=none
### Heading three
:::

#### 6. Bullet list in a callout with no icon

:::^ icon=none
- First item
- Second item
  - Nested item
    - Third level
- Last item
:::

#### 7. Numbered list in a callout with no icon

:::^ icon=none
1. First
2. Second
   1. Nested
3. Third
:::

#### 8. Todo list in a callout with no icon

:::^ icon=none
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo
:::

#### 9. Quote in a callout with no icon

:::^ icon=none
> A quote that runs over
> two lines.
:::

#### 10. Code block in a callout with no icon

:::^ icon=none
```
plain code
  indented line
```
:::

#### 11. Code block (TypeScript) in a callout with no icon

:::^ icon=none
```ts
const greeting: string = "hello";
console.log(greeting);
```
:::

#### 12. JSON block (no language) in a callout with no icon

:::^ icon=none
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```
:::

#### 13. Diagram in a callout with no icon

:::^ icon=none
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
:::

#### 14. Table in a callout with no icon

:::^ icon=none
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |
:::

#### 15. Divider in a callout with no icon

:::^ icon=none
---
:::

#### 16. Key: Value line in a callout with no icon

:::^ icon=none
**Wi-Fi password:** correct-horse-battery
:::

#### 17. Image in a callout with no icon

:::^ icon=none
![A sample picture](attachment:photo.png)
:::

#### 18. File in a callout with no icon

:::^ icon=none
[Budget.csv](attachment:budget.csv)
:::

#### 19. Missing file in a callout with no icon

:::^ icon=none
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)
:::

#### 20. Card in a callout with no icon

:::^ icon=none
::: card
Text in a card.
:::
:::

#### 21. Callout (info) in a callout with no icon

:::^ icon=none
:::i
Text in an info callout.
:::
:::

#### 22. Callout (warning, chosen icon) in a callout with no icon

:::^ icon=none
:::! icon=flag
Text in a warning callout with the flag icon.
:::
:::

#### 23. Callout (decision, no icon) in a callout with no icon

:::^ icon=none
:::^ icon=none
Text in a decision callout with no icon.
:::
:::
