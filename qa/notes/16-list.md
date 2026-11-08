# QA · Everything in a list item

Each element in a list item. Check: it draws as it does on its own, sits inside the container's edges with even space around it, and its Markdown shows while the cursor is in it. Tables, spreadsheets, diagrams and attachments in quotes and list items stay as Markdown.

#qa/containers

#### 1. Paragraph in a list item

- List item

  A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

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

#### 14. Diagram (240 px wide) in a list item (stays Markdown here)

- List item

  ```mermaid |240
  flowchart LR
    A[Small] --> B[Diagram]
  ```

#### 15. 3D model (openscad block), a colored part, an echo in a list item

- List item

  ```openscad
  difference() {
    cube(20, center = true);
    sphere(r = 13);
  }
  translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
  echo("made");
  ```

#### 16. Flat model (openscad block) in a list item

- List item

  ```openscad
  square(20);
  translate([30, 10]) circle(8);
  ```

#### 17. Broken model (openscad block) in a list item

- List item

  ```openscad
  cube(10)
  sphere(3;
  ```

#### 18. 3D model (stl block) in a list item

- List item

  ```stl
  solid pyramid
  facet normal 0 0 -1
  outer loop
  vertex 0 0 0
  vertex 10 10 0
  vertex 10 0 0
  endloop
  endfacet
  facet normal 0 0 -1
  outer loop
  vertex 0 0 0
  vertex 0 10 0
  vertex 10 10 0
  endloop
  endfacet
  facet normal 0 -1 1
  outer loop
  vertex 0 0 0
  vertex 10 0 0
  vertex 5 5 8
  endloop
  endfacet
  facet normal 1 0 1
  outer loop
  vertex 10 0 0
  vertex 10 10 0
  vertex 5 5 8
  endloop
  endfacet
  facet normal 0 1 1
  outer loop
  vertex 10 10 0
  vertex 0 10 0
  vertex 5 5 8
  endloop
  endfacet
  facet normal -1 0 1
  outer loop
  vertex 0 10 0
  vertex 0 0 0
  vertex 5 5 8
  endloop
  endfacet
  endsolid pyramid
  ```

#### 19. Timing diagram (wavedrom block) in a list item (stays Markdown here)

- List item

  ```wavedrom
  { signal: [
    { name: "clk", wave: "p.....|..." },
    { name: "data", wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
    {},
    { name: "ack", wave: "1.....|01.", node: ".a......b" }
  ], edge: ["a~>b t1"] }
  ```

#### 20. Math block in a list item (stays Markdown here)

- List item

  $$
  \int_0^1 x^2\,dx = \frac{1}{3}
  $$

#### 21. Table in a list item (stays Markdown here)

- List item

  | Left | Center | Right |
  | :--- | :----: | ----: |
  | a | **b** | 1 |
  | longer cell text | `code` | 22 |

#### 22. Table with formulas in a list item (stays Markdown here)

- List item

  | Item | Cost |
  | --- | ---: |
  | Rent | 1200 |
  | Food | 450.50 |
  | Total | =SUM(B2:B3) |
  | Broken | =B2/0 |

#### 23. Hurl entries (hurl block): a capture used by the next entry, and asserts in a list item

- List item

  ```hurl
  # A todo
  GET https://jsonplaceholder.typicode.com/todos/1
  HTTP 200
  [Captures]
  owner: jsonpath "$.userId"
  [Asserts]
  jsonpath "$.id" == 1

  # Its owner
  GET https://jsonplaceholder.typicode.com/users/{{owner}}
  HTTP 200
  [Asserts]
  jsonpath "$.name" isString
  ```

#### 24. Secret ({{name}}, kept in a locked secrets note) in a list item

- List item

  The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 25. API requests (http block): a variable, a named request and one using its response in a list item

- List item

  ```http
  @api = https://jsonplaceholder.typicode.com

  ### A todo
  # @name todo
  GET {{api}}/todos/1

  ### Its owner
  GET {{api}}/users/{{todo.response.body.$.userId}}
  ```

#### 26. Spreadsheet (csv block) in a list item (stays Markdown here)

- List item

  ```csv
  Item, Cost
  Rent, 1200
  Food, 450.50
  Total, =SUM(B2:B3)
  ```

#### 27. Named spreadsheet (csv name=), and a formula in another block using it in a list item (stays Markdown here)

- List item

  ```csv name=costs
  Item, Cost, Day
  Rent, $1200, 2026-01-05
  ```

  ```csv
  Total, =costs!B2*2
  ```

#### 28. Divider in a list item

- List item

  ---

#### 29. Key: Value line in a list item

- List item

  **Wi-Fi password:** correct-horse-battery

#### 30. Mention in a list item

- List item

  Ask @[QA · Ada] at @[QA · Ada].email.

#### 31. Wiki link in a list item

- List item

  Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 32. Symbols in a list item

- List item

  Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 33. GitHub links in a list item

- List item

  Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 34. arXiv links in a list item

- List item

  Paper https://arxiv.org/abs/1706.03762 and [a named link](https://arxiv.org/abs/2006.11239)

#### 35. Image in a list item (stays Markdown here)

- List item

  ![A sample picture](attachment:photo.png)

#### 36. Drawing in a list item (stays Markdown here)

- List item

  ![A sample drawing](attachment:drawing.svg)

#### 37. File in a list item (stays Markdown here)

- List item

  [Budget.csv](attachment:budget.csv)

#### 38. Attached 3D model (STL) in a list item

- List item

  [Bracket.stl](attachment:bracket.stl)

#### 39. Terminal recording (.cast file) in a list item

- List item

  [terminal.cast](attachment:terminal.cast)

#### 40. Missing file in a list item (stays Markdown here)

- List item

  [Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 41. Card in a list item

- List item

  ::: card
  Text in a card.
  :::

#### 42. Callout (info) in a list item

- List item

  :::i
  Text in an info callout.
  :::

#### 43. Callout (warning, chosen icon) in a list item

- List item

  :::! icon=flag
  Text in a warning callout with the flag icon.
  :::

#### 44. Callout (decision, no icon) in a list item

- List item

  :::^ icon=none
  Text in a decision callout with no icon.
  :::
