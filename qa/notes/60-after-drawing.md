# QA · Right after: Drawing

Drawing followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Drawing, then Paragraph

![A sample drawing](attachment:drawing.svg)
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Drawing, then Long paragraph

![A sample drawing](attachment:drawing.svg)
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Drawing, then Heading 1

![A sample drawing](attachment:drawing.svg)
# Heading one

#### 4. Drawing, then Heading 2

![A sample drawing](attachment:drawing.svg)
## Heading two

#### 5. Drawing, then Heading 3

![A sample drawing](attachment:drawing.svg)
### Heading three

#### 6. Drawing, then Bullet list

![A sample drawing](attachment:drawing.svg)
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Drawing, then Numbered list

![A sample drawing](attachment:drawing.svg)
1. First
2. Second
   1. Nested
3. Third

#### 8. Drawing, then Todo list

![A sample drawing](attachment:drawing.svg)
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Drawing, then Quote

![A sample drawing](attachment:drawing.svg)
> A quote that runs over
> two lines.

#### 10. Drawing, then Line marks

![A sample drawing](attachment:drawing.svg)
Marked as the accent. <!-- mark -->
Two lines marked green, one bar. <!-- mark green: ready -->
The second of them. <!-- mark green: ready -->
Red, with a label to point at. <!-- mark red: to fix -->
- A list item, marked purple. <!-- mark purple -->

#### 11. Drawing, then Code block

![A sample drawing](attachment:drawing.svg)
```
plain code
  indented line
```

#### 12. Drawing, then Code block (TypeScript)

![A sample drawing](attachment:drawing.svg)
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 13. Drawing, then JSON block (no language)

![A sample drawing](attachment:drawing.svg)
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 14. Drawing, then Diagram

![A sample drawing](attachment:drawing.svg)
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 15. Drawing, then Diagram (240 px wide)

![A sample drawing](attachment:drawing.svg)
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 16. Drawing, then 3D model (openscad block), a colored part, an echo

![A sample drawing](attachment:drawing.svg)
```openscad
difference() {
  cube(20, center = true);
  sphere(r = 13);
}
translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
echo("made");
```

#### 17. Drawing, then Flat model (openscad block)

![A sample drawing](attachment:drawing.svg)
```openscad
square(20);
translate([30, 10]) circle(8);
```

#### 18. Drawing, then Broken model (openscad block)

![A sample drawing](attachment:drawing.svg)
```openscad
cube(10)
sphere(3;
```

#### 19. Drawing, then 3D model (stl block)

![A sample drawing](attachment:drawing.svg)
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

#### 20. Drawing, then Timing diagram (wavedrom block)

![A sample drawing](attachment:drawing.svg)
```wavedrom
{ signal: [
  { name: "clk", wave: "p.....|..." },
  { name: "data", wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  {},
  { name: "ack", wave: "1.....|01.", node: ".a......b" }
], edge: ["a~>b t1"] }
```

#### 21. Drawing, then Typing practice (typing block)

![A sample drawing](attachment:drawing.svg)
```typing
It’s a “fine” day — type it.
function go() {
  return 1;
}
```

#### 22. Drawing, then Math block

![A sample drawing](attachment:drawing.svg)
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 23. Drawing, then Table

![A sample drawing](attachment:drawing.svg)
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 24. Drawing, then Table with formulas

![A sample drawing](attachment:drawing.svg)
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 25. Drawing, then Hurl entries (hurl block): a capture used by the next entry, and asserts

![A sample drawing](attachment:drawing.svg)
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

#### 26. Drawing, then Secret ({{name}}, kept in a locked secrets note)

![A sample drawing](attachment:drawing.svg)
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 27. Drawing, then API requests (http block): a variable, a named request and one using its response

![A sample drawing](attachment:drawing.svg)
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 28. Drawing, then Spreadsheet (csv block)

![A sample drawing](attachment:drawing.svg)
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 29. Drawing, then Named spreadsheet (csv name=), and a formula in another block using it

![A sample drawing](attachment:drawing.svg)
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 30. Drawing, then Divider

![A sample drawing](attachment:drawing.svg)
---

#### 31. Drawing, then Page breaks (as lines writes them, and as Obsidian and Typora do; a new page in the PDF at each, a gap between pages over a backdrop)

![A sample drawing](attachment:drawing.svg)
Before the break.

<!-- pagebreak -->
After it, on a new page.

<div style="page-break-after: always"></div>

And another.

#### 32. Drawing, then Key: Value line

![A sample drawing](attachment:drawing.svg)
**Wi-Fi password:** correct-horse-battery

#### 33. Drawing, then Score (Settings → Little Touches)

![A sample drawing](attachment:drawing.svg)
Rating: 4/5
Score: 7 / 10
Not a score: 12/20

#### 34. Drawing, then Mention

![A sample drawing](attachment:drawing.svg)
Ask @[QA · Ada] at @[QA · Ada].email.

#### 35. Drawing, then Wiki link

![A sample drawing](attachment:drawing.svg)
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 36. Drawing, then Symbols

![A sample drawing](attachment:drawing.svg)
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 37. Drawing, then GitHub links

![A sample drawing](attachment:drawing.svg)
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 38. Drawing, then arXiv links

![A sample drawing](attachment:drawing.svg)
Paper https://arxiv.org/abs/1706.03762 and [a named link](https://arxiv.org/abs/2006.11239)

#### 39. Drawing, then Time in an episode

![A sample drawing](attachment:drawing.svg)
At [12:34](https://traffic.megaphone.fm/FSI3647670844.mp3#t=754) they said it; [3:16] stays text here

#### 40. Drawing, then Image

![A sample drawing](attachment:drawing.svg)
![A sample picture](attachment:photo.png)

#### 41. Drawing, then Drawing

![A sample drawing](attachment:drawing.svg)
![A sample drawing](attachment:drawing.svg)

#### 42. Drawing, then File

![A sample drawing](attachment:drawing.svg)
[Budget.csv](attachment:budget.csv)

#### 43. Drawing, then Folder and file links

![A sample drawing](attachment:drawing.svg)
See [Projects](file:///Users/me/My%20Projects/) and [the plan](file:///Users/me/plan.pdf) on this computer.

#### 44. Drawing, then Attached 3D model (STL)

![A sample drawing](attachment:drawing.svg)
[Bracket.stl](attachment:bracket.stl)

#### 45. Drawing, then Terminal recording (.cast file)

![A sample drawing](attachment:drawing.svg)
[terminal.cast](attachment:terminal.cast)

#### 46. Drawing, then Audio

![A sample drawing](attachment:drawing.svg)
[Chime.mp3](attachment:chime.mp3)

#### 47. Drawing, then Video

![A sample drawing](attachment:drawing.svg)
[Sky.mp4](attachment:sky.mp4)

#### 48. Drawing, then Missing file

![A sample drawing](attachment:drawing.svg)
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 49. Drawing, then Card

![A sample drawing](attachment:drawing.svg)
::: card
Text in a card.
:::

#### 50. Drawing, then Callout (info)

![A sample drawing](attachment:drawing.svg)
:::i
Text in an info callout.
:::

#### 51. Drawing, then Callout (warning, chosen icon)

![A sample drawing](attachment:drawing.svg)
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 52. Drawing, then Callout (decision, no icon)

![A sample drawing](attachment:drawing.svg)
:::^ icon=none
Text in a decision callout with no icon.
:::
