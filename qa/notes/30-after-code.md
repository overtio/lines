# QA · Right after: Code block

Code block followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Code block, then Paragraph

```
plain code
  indented line
```
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Code block, then Long paragraph

```
plain code
  indented line
```
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Code block, then Heading 1

```
plain code
  indented line
```
# Heading one

#### 4. Code block, then Heading 2

```
plain code
  indented line
```
## Heading two

#### 5. Code block, then Heading 3

```
plain code
  indented line
```
### Heading three

#### 6. Code block, then Bullet list

```
plain code
  indented line
```
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Code block, then Numbered list

```
plain code
  indented line
```
1. First
2. Second
   1. Nested
3. Third

#### 8. Code block, then Todo list

```
plain code
  indented line
```
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Code block, then Quote

```
plain code
  indented line
```
> A quote that runs over
> two lines.

#### 10. Code block, then Line marks

```
plain code
  indented line
```
Marked as the accent. <!-- mark -->
Two lines marked green, one bar. <!-- mark green: ready -->
The second of them. <!-- mark green: ready -->
Red, with a label to point at. <!-- mark red: to fix -->
- A list item, marked purple. <!-- mark purple -->

#### 11. Code block, then Code block

```
plain code
  indented line
```
```
plain code
  indented line
```

#### 12. Code block, then Code block (TypeScript)

```
plain code
  indented line
```
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 13. Code block, then JSON block (no language)

```
plain code
  indented line
```
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 14. Code block, then Diagram

```
plain code
  indented line
```
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 15. Code block, then Diagram (240 px wide)

```
plain code
  indented line
```
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 16. Code block, then 3D model (openscad block), a colored part, an echo

```
plain code
  indented line
```
```openscad
difference() {
  cube(20, center = true);
  sphere(r = 13);
}
translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
echo("made");
```

#### 17. Code block, then Flat model (openscad block)

```
plain code
  indented line
```
```openscad
square(20);
translate([30, 10]) circle(8);
```

#### 18. Code block, then Broken model (openscad block)

```
plain code
  indented line
```
```openscad
cube(10)
sphere(3;
```

#### 19. Code block, then 3D model (stl block)

```
plain code
  indented line
```
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

#### 20. Code block, then Timing diagram (wavedrom block)

```
plain code
  indented line
```
```wavedrom
{ signal: [
  { name: "clk", wave: "p.....|..." },
  { name: "data", wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  {},
  { name: "ack", wave: "1.....|01.", node: ".a......b" }
], edge: ["a~>b t1"] }
```

#### 21. Code block, then Typing practice (typing block)

```
plain code
  indented line
```
```typing
It’s a “fine” day — type it.
function go() {
  return 1;
}
```

#### 22. Code block, then Math block

```
plain code
  indented line
```
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 23. Code block, then Table

```
plain code
  indented line
```
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 24. Code block, then Table with formulas

```
plain code
  indented line
```
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 25. Code block, then Hurl entries (hurl block): a capture used by the next entry, and asserts

```
plain code
  indented line
```
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

#### 26. Code block, then Secret ({{name}}, kept in a locked secrets note)

```
plain code
  indented line
```
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 27. Code block, then API requests (http block): a variable, a named request and one using its response

```
plain code
  indented line
```
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 28. Code block, then Spreadsheet (csv block)

```
plain code
  indented line
```
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 29. Code block, then Named spreadsheet (csv name=), and a formula in another block using it

```
plain code
  indented line
```
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 30. Code block, then Divider

```
plain code
  indented line
```
---

#### 31. Code block, then Page breaks (as lines writes them, and as Obsidian and Typora do; a new page in the PDF at each, a gap between pages over a backdrop)

```
plain code
  indented line
```
Before the break.

<!-- pagebreak -->
After it, on a new page.

<div style="page-break-after: always"></div>

And another.

#### 32. Code block, then Key: Value line

```
plain code
  indented line
```
**Wi-Fi password:** correct-horse-battery

#### 33. Code block, then Score (Settings → Little Touches)

```
plain code
  indented line
```
Rating: 4/5
Score: 7 / 10
Not a score: 12/20

#### 34. Code block, then Mention

```
plain code
  indented line
```
Ask @[QA · Ada] at @[QA · Ada].email.

#### 35. Code block, then Wiki link

```
plain code
  indented line
```
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 36. Code block, then Symbols

```
plain code
  indented line
```
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 37. Code block, then GitHub links

```
plain code
  indented line
```
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 38. Code block, then arXiv links

```
plain code
  indented line
```
Paper https://arxiv.org/abs/1706.03762 and [a named link](https://arxiv.org/abs/2006.11239)

#### 39. Code block, then Image

```
plain code
  indented line
```
![A sample picture](attachment:photo.png)

#### 40. Code block, then Drawing

```
plain code
  indented line
```
![A sample drawing](attachment:drawing.svg)

#### 41. Code block, then File

```
plain code
  indented line
```
[Budget.csv](attachment:budget.csv)

#### 42. Code block, then Folder and file links

```
plain code
  indented line
```
See [Projects](file:///Users/me/My%20Projects/) and [the plan](file:///Users/me/plan.pdf) on this computer.

#### 43. Code block, then Attached 3D model (STL)

```
plain code
  indented line
```
[Bracket.stl](attachment:bracket.stl)

#### 44. Code block, then Terminal recording (.cast file)

```
plain code
  indented line
```
[terminal.cast](attachment:terminal.cast)

#### 45. Code block, then Audio

```
plain code
  indented line
```
[Chime.mp3](attachment:chime.mp3)

#### 46. Code block, then Video

```
plain code
  indented line
```
[Sky.mp4](attachment:sky.mp4)

#### 47. Code block, then Missing file

```
plain code
  indented line
```
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 48. Code block, then Card

```
plain code
  indented line
```
::: card
Text in a card.
:::

#### 49. Code block, then Callout (info)

```
plain code
  indented line
```
:::i
Text in an info callout.
:::

#### 50. Code block, then Callout (warning, chosen icon)

```
plain code
  indented line
```
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 51. Code block, then Callout (decision, no icon)

```
plain code
  indented line
```
:::^ icon=none
Text in a decision callout with no icon.
:::
