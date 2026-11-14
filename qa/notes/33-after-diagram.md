# QA · Right after: Diagram

Diagram followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Diagram, then Paragraph

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Diagram, then Long paragraph

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Diagram, then Heading 1

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
# Heading one

#### 4. Diagram, then Heading 2

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
## Heading two

#### 5. Diagram, then Heading 3

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
### Heading three

#### 6. Diagram, then Bullet list

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Diagram, then Numbered list

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
1. First
2. Second
   1. Nested
3. Third

#### 8. Diagram, then Todo list

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Diagram, then Quote

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
> A quote that runs over
> two lines.

#### 10. Diagram, then Line marks

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Marked as the accent. <!-- mark -->
Two lines marked green, one bar. <!-- mark green: ready -->
The second of them. <!-- mark green: ready -->
Red, with a label to point at. <!-- mark red: to fix -->
- A list item, marked purple. <!-- mark purple -->

#### 11. Diagram, then Code block

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```
plain code
  indented line
```

#### 12. Diagram, then Code block (TypeScript)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 13. Diagram, then JSON block (no language)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 14. Diagram, then Diagram

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 15. Diagram, then Diagram (240 px wide)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 16. Diagram, then 3D model (openscad block), a colored part, an echo

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```openscad
difference() {
  cube(20, center = true);
  sphere(r = 13);
}
translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
echo("made");
```

#### 17. Diagram, then Flat model (openscad block)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```openscad
square(20);
translate([30, 10]) circle(8);
```

#### 18. Diagram, then Broken model (openscad block)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```openscad
cube(10)
sphere(3;
```

#### 19. Diagram, then 3D model (stl block)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
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

#### 20. Diagram, then Timing diagram (wavedrom block)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```wavedrom
{ signal: [
  { name: "clk", wave: "p.....|..." },
  { name: "data", wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  {},
  { name: "ack", wave: "1.....|01.", node: ".a......b" }
], edge: ["a~>b t1"] }
```

#### 21. Diagram, then Typing practice (typing block)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```typing
It’s a “fine” day — type it.
function go() {
  return 1;
}
```

#### 22. Diagram, then Math block

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 23. Diagram, then Table

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 24. Diagram, then Table with formulas

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 25. Diagram, then Hurl entries (hurl block): a capture used by the next entry, and asserts

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
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

#### 26. Diagram, then Secret ({{name}}, kept in a locked secrets note)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 27. Diagram, then API requests (http block): a variable, a named request and one using its response

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 28. Diagram, then Spreadsheet (csv block)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 29. Diagram, then Named spreadsheet (csv name=), and a formula in another block using it

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 30. Diagram, then Divider

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
---

#### 31. Diagram, then Page breaks (as lines writes them, and as Obsidian and Typora do; a new page in the PDF at each, a gap between pages over a backdrop)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Before the break.

<!-- pagebreak -->
After it, on a new page.

<div style="page-break-after: always"></div>

And another.

#### 32. Diagram, then Key: Value line

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
**Wi-Fi password:** correct-horse-battery

#### 33. Diagram, then Score (Settings → Little Touches)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Rating: 4/5
Half: 3.5/5
Score: 7 / 10
Not a score: 12/20

#### 34. Diagram, then Mention

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Ask @[QA · Ada] at @[QA · Ada].email.

#### 35. Diagram, then Wiki link

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 36. Diagram, then Symbols

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 37. Diagram, then GitHub links

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 38. Diagram, then arXiv links

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
Paper https://arxiv.org/abs/1706.03762 and [a named link](https://arxiv.org/abs/2006.11239)

#### 39. Diagram, then Time in an episode

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
At [12:34](https://traffic.megaphone.fm/FSI3647670844.mp3#t=754) they said it; [3:16] stays text here

#### 40. Diagram, then Image

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
![A sample picture](attachment:photo.png)

#### 41. Diagram, then Drawing

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
![A sample drawing](attachment:drawing.svg)

#### 42. Diagram, then File

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
[Budget.csv](attachment:budget.csv)

#### 43. Diagram, then Folder and file links

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
See [Projects](file:///Users/me/My%20Projects/) and [the plan](file:///Users/me/plan.pdf) on this computer.

#### 44. Diagram, then Attached 3D model (STL)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
[Bracket.stl](attachment:bracket.stl)

#### 45. Diagram, then Terminal recording (.cast file)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
[terminal.cast](attachment:terminal.cast)

#### 46. Diagram, then Audio

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
[Chime.mp3](attachment:chime.mp3)

#### 47. Diagram, then Video

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
[Sky.mp4](attachment:sky.mp4)

#### 48. Diagram, then Missing file

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 49. Diagram, then Card

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
::: card
Text in a card.
:::

#### 50. Diagram, then Callout (info)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
:::i
Text in an info callout.
:::

#### 51. Diagram, then Callout (warning, chosen icon)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 52. Diagram, then Callout (decision, no icon)

```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```
:::^ icon=none
Text in a decision callout with no icon.
:::
