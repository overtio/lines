# QA · Right after: Mention

Mention followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Mention, then Paragraph

Ask @[QA · Ada] at @[QA · Ada].email.
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Mention, then Long paragraph

Ask @[QA · Ada] at @[QA · Ada].email.
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Mention, then Heading 1

Ask @[QA · Ada] at @[QA · Ada].email.
# Heading one

#### 4. Mention, then Heading 2

Ask @[QA · Ada] at @[QA · Ada].email.
## Heading two

#### 5. Mention, then Heading 3

Ask @[QA · Ada] at @[QA · Ada].email.
### Heading three

#### 6. Mention, then Bullet list

Ask @[QA · Ada] at @[QA · Ada].email.
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Mention, then Numbered list

Ask @[QA · Ada] at @[QA · Ada].email.
1. First
2. Second
   1. Nested
3. Third

#### 8. Mention, then Todo list

Ask @[QA · Ada] at @[QA · Ada].email.
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Mention, then Quote

Ask @[QA · Ada] at @[QA · Ada].email.
> A quote that runs over
> two lines.

#### 10. Mention, then Code block

Ask @[QA · Ada] at @[QA · Ada].email.
```
plain code
  indented line
```

#### 11. Mention, then Code block (TypeScript)

Ask @[QA · Ada] at @[QA · Ada].email.
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Mention, then JSON block (no language)

Ask @[QA · Ada] at @[QA · Ada].email.
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Mention, then Diagram

Ask @[QA · Ada] at @[QA · Ada].email.
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Mention, then Diagram (240 px wide)

Ask @[QA · Ada] at @[QA · Ada].email.
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Mention, then 3D model (openscad block), a colored part, an echo

Ask @[QA · Ada] at @[QA · Ada].email.
```openscad
difference() {
  cube(20, center = true);
  sphere(r = 13);
}
translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
echo("made");
```

#### 16. Mention, then Flat model (openscad block)

Ask @[QA · Ada] at @[QA · Ada].email.
```openscad
square(20);
translate([30, 10]) circle(8);
```

#### 17. Mention, then Broken model (openscad block)

Ask @[QA · Ada] at @[QA · Ada].email.
```openscad
cube(10)
sphere(3;
```

#### 18. Mention, then 3D model (stl block)

Ask @[QA · Ada] at @[QA · Ada].email.
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

#### 19. Mention, then Timing diagram (wavedrom block)

Ask @[QA · Ada] at @[QA · Ada].email.
```wavedrom
{ signal: [
  { name: "clk", wave: "p.....|..." },
  { name: "data", wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  {},
  { name: "ack", wave: "1.....|01.", node: ".a......b" }
], edge: ["a~>b t1"] }
```

#### 20. Mention, then Math block

Ask @[QA · Ada] at @[QA · Ada].email.
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 21. Mention, then Table

Ask @[QA · Ada] at @[QA · Ada].email.
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 22. Mention, then Table with formulas

Ask @[QA · Ada] at @[QA · Ada].email.
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 23. Mention, then Hurl entries (hurl block): a capture used by the next entry, and asserts

Ask @[QA · Ada] at @[QA · Ada].email.
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

#### 24. Mention, then Secret ({{name}}, kept in a locked secrets note)

Ask @[QA · Ada] at @[QA · Ada].email.
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 25. Mention, then API requests (http block): a variable, a named request and one using its response

Ask @[QA · Ada] at @[QA · Ada].email.
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 26. Mention, then Spreadsheet (csv block)

Ask @[QA · Ada] at @[QA · Ada].email.
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 27. Mention, then Named spreadsheet (csv name=), and a formula in another block using it

Ask @[QA · Ada] at @[QA · Ada].email.
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 28. Mention, then Divider

Ask @[QA · Ada] at @[QA · Ada].email.
---

#### 29. Mention, then Key: Value line

Ask @[QA · Ada] at @[QA · Ada].email.
**Wi-Fi password:** correct-horse-battery

#### 30. Mention, then Mention

Ask @[QA · Ada] at @[QA · Ada].email.
Ask @[QA · Ada] at @[QA · Ada].email.

#### 31. Mention, then Wiki link

Ask @[QA · Ada] at @[QA · Ada].email.
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 32. Mention, then Symbols

Ask @[QA · Ada] at @[QA · Ada].email.
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 33. Mention, then GitHub links

Ask @[QA · Ada] at @[QA · Ada].email.
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 34. Mention, then arXiv links

Ask @[QA · Ada] at @[QA · Ada].email.
Paper https://arxiv.org/abs/1706.03762 and [a named link](https://arxiv.org/abs/2006.11239)

#### 35. Mention, then Image

Ask @[QA · Ada] at @[QA · Ada].email.
![A sample picture](attachment:photo.png)

#### 36. Mention, then Drawing

Ask @[QA · Ada] at @[QA · Ada].email.
![A sample drawing](attachment:drawing.svg)

#### 37. Mention, then File

Ask @[QA · Ada] at @[QA · Ada].email.
[Budget.csv](attachment:budget.csv)

#### 38. Mention, then Attached 3D model (STL)

Ask @[QA · Ada] at @[QA · Ada].email.
[Bracket.stl](attachment:bracket.stl)

#### 39. Mention, then Terminal recording (.cast file)

Ask @[QA · Ada] at @[QA · Ada].email.
[terminal.cast](attachment:terminal.cast)

#### 40. Mention, then Missing file

Ask @[QA · Ada] at @[QA · Ada].email.
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 41. Mention, then Card

Ask @[QA · Ada] at @[QA · Ada].email.
::: card
Text in a card.
:::

#### 42. Mention, then Callout (info)

Ask @[QA · Ada] at @[QA · Ada].email.
:::i
Text in an info callout.
:::

#### 43. Mention, then Callout (warning, chosen icon)

Ask @[QA · Ada] at @[QA · Ada].email.
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 44. Mention, then Callout (decision, no icon)

Ask @[QA · Ada] at @[QA · Ada].email.
:::^ icon=none
Text in a decision callout with no icon.
:::
