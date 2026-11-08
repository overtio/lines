# QA · Right after: Card

Card followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Card, then Paragraph

::: card
Text in a card.
:::
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

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

#### 14. Card, then Diagram (240 px wide)

::: card
Text in a card.
:::
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Card, then 3D model (openscad block), a colored part, an echo

::: card
Text in a card.
:::
```openscad
difference() {
  cube(20, center = true);
  sphere(r = 13);
}
translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
echo("made");
```

#### 16. Card, then Flat model (openscad block)

::: card
Text in a card.
:::
```openscad
square(20);
translate([30, 10]) circle(8);
```

#### 17. Card, then Broken model (openscad block)

::: card
Text in a card.
:::
```openscad
cube(10)
sphere(3;
```

#### 18. Card, then 3D model (stl block)

::: card
Text in a card.
:::
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

#### 19. Card, then Timing diagram (wavedrom block)

::: card
Text in a card.
:::
```wavedrom
{ signal: [
  { name: "clk", wave: "p.....|..." },
  { name: "data", wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  {},
  { name: "ack", wave: "1.....|01.", node: ".a......b" }
], edge: ["a~>b t1"] }
```

#### 20. Card, then Math block

::: card
Text in a card.
:::
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 21. Card, then Table

::: card
Text in a card.
:::
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 22. Card, then Table with formulas

::: card
Text in a card.
:::
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 23. Card, then Hurl entries (hurl block): a capture used by the next entry, and asserts

::: card
Text in a card.
:::
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

#### 24. Card, then Secret ({{name}}, kept in a locked secrets note)

::: card
Text in a card.
:::
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 25. Card, then API requests (http block): a variable, a named request and one using its response

::: card
Text in a card.
:::
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 26. Card, then Spreadsheet (csv block)

::: card
Text in a card.
:::
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 27. Card, then Named spreadsheet (csv name=), and a formula in another block using it

::: card
Text in a card.
:::
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 28. Card, then Divider

::: card
Text in a card.
:::
---

#### 29. Card, then Key: Value line

::: card
Text in a card.
:::
**Wi-Fi password:** correct-horse-battery

#### 30. Card, then Mention

::: card
Text in a card.
:::
Ask @[QA · Ada] at @[QA · Ada].email.

#### 31. Card, then Wiki link

::: card
Text in a card.
:::
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 32. Card, then Symbols

::: card
Text in a card.
:::
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 33. Card, then GitHub links

::: card
Text in a card.
:::
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 34. Card, then arXiv links

::: card
Text in a card.
:::
Paper https://arxiv.org/abs/1706.03762 and [a named link](https://arxiv.org/abs/2006.11239)

#### 35. Card, then Image

::: card
Text in a card.
:::
![A sample picture](attachment:photo.png)

#### 36. Card, then Drawing

::: card
Text in a card.
:::
![A sample drawing](attachment:drawing.svg)

#### 37. Card, then File

::: card
Text in a card.
:::
[Budget.csv](attachment:budget.csv)

#### 38. Card, then Attached 3D model (STL)

::: card
Text in a card.
:::
[Bracket.stl](attachment:bracket.stl)

#### 39. Card, then Terminal recording (.cast file)

::: card
Text in a card.
:::
[terminal.cast](attachment:terminal.cast)

#### 40. Card, then Missing file

::: card
Text in a card.
:::
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 41. Card, then Card

::: card
Text in a card.
:::
::: card
Text in a card.
:::

#### 42. Card, then Callout (info)

::: card
Text in a card.
:::
:::i
Text in an info callout.
:::

#### 43. Card, then Callout (warning, chosen icon)

::: card
Text in a card.
:::
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 44. Card, then Callout (decision, no icon)

::: card
Text in a card.
:::
:::^ icon=none
Text in a decision callout with no icon.
:::
