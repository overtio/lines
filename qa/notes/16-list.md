# QA · Everything in a list item

Each element in a list item. Check: it draws as it does on its own, sits inside the container's edges with even space around it, and its Markdown shows while the cursor is in it. Tables, diagrams and attachments in quotes and list items stay as Markdown.

#qa/containers

#### 1. Paragraph in a list item

- List item

  A paragraph with **bold**, *italic*, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Long paragraph in a list item

- List item

  A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Heading 1 in a list item

- List item

  # Heading one

#### 4. Heading 2 in a list item

- List item

  ## Heading two

#### 5. Heading 3 in a list item

- List item

  ### Heading three

#### 6. Bullet list in a list item

- List item

  - First item
  - Second item
    - Nested item
      - Third level
  - Last item

#### 7. Numbered list in a list item

- List item

  1. First
  2. Second
     1. Nested
  3. Third

#### 8. Todo list in a list item

- List item

  - [x] Done todo
  - [ ] Open todo
    - [ ] Nested open todo

#### 9. Quote in a list item

- List item

  > A quote that runs over
  > two lines.

#### 10. Code block in a list item

- List item

  ```
  plain code
    indented line
  ```

#### 11. Code block (TypeScript) in a list item

- List item

  ```ts
  const greeting: string = "hello";
  console.log(greeting);
  ```

#### 12. JSON block (no language) in a list item

- List item

  ```
  {"name":"lines","tags":["a","b"],"id":12345678901234567890}
  ```

#### 13. Diagram in a list item (stays Markdown here)

- List item

  ```mermaid
  flowchart LR
    A[Start] --> B{Choice}
    B --> C[Done]
  ```

#### 14. Table in a list item (stays Markdown here)

- List item

  | Left | Center | Right |
  | :--- | :----: | ----: |
  | a | **b** | 1 |
  | longer cell text | `code` | 22 |

#### 15. Divider in a list item

- List item

  ---

#### 16. Key: Value line in a list item

- List item

  **Wi-Fi password:** correct-horse-battery

#### 17. Image in a list item (stays Markdown here)

- List item

  ![A sample picture](attachment:photo.png)

#### 18. File in a list item (stays Markdown here)

- List item

  [Budget.csv](attachment:budget.csv)

#### 19. Missing file in a list item (stays Markdown here)

- List item

  [Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 20. Card in a list item

- List item

  ::: card
  Text in a card.
  :::

#### 21. Callout (info) in a list item

- List item

  :::i
  Text in an info callout.
  :::

#### 22. Callout (warning, chosen icon) in a list item

- List item

  :::! icon=flag
  Text in a warning callout with the flag icon.
  :::

#### 23. Callout (decision, no icon) in a list item

- List item

  :::^ icon=none
  Text in a decision callout with no icon.
  :::
