# QA · Right after: Video

Video followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Video, then Paragraph

[Sky.mp4](attachment:sky.mp4)
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Video, then Long paragraph

[Sky.mp4](attachment:sky.mp4)
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Video, then Heading 1

[Sky.mp4](attachment:sky.mp4)
# Heading one

#### 4. Video, then Heading 2

[Sky.mp4](attachment:sky.mp4)
## Heading two

#### 5. Video, then Heading 3

[Sky.mp4](attachment:sky.mp4)
### Heading three

#### 6. Video, then Bullet list

[Sky.mp4](attachment:sky.mp4)
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Video, then Numbered list

[Sky.mp4](attachment:sky.mp4)
1. First
2. Second
   1. Nested
3. Third

#### 8. Video, then Todo list

[Sky.mp4](attachment:sky.mp4)
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Video, then Quote

[Sky.mp4](attachment:sky.mp4)
> A quote that runs over
> two lines.

#### 10. Video, then Line marks

[Sky.mp4](attachment:sky.mp4)
Marked as the accent. <!-- mark -->
Two lines marked green, one bar. <!-- mark green: ready -->
The second of them. <!-- mark green: ready -->
Red, with a label to point at. <!-- mark red: to fix -->
- A list item, marked purple. <!-- mark purple -->

#### 11. Video, then Code block

[Sky.mp4](attachment:sky.mp4)
```
plain code
  indented line
```

#### 12. Video, then Code block (TypeScript)

[Sky.mp4](attachment:sky.mp4)
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 13. Video, then JSON block (no language)

[Sky.mp4](attachment:sky.mp4)
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 14. Video, then Diagram

[Sky.mp4](attachment:sky.mp4)
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 15. Video, then Diagram (240 px wide)

[Sky.mp4](attachment:sky.mp4)
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 16. Video, then 3D model (openscad block), a colored part, an echo

[Sky.mp4](attachment:sky.mp4)
```openscad
difference() {
  cube(20, center = true);
  sphere(r = 13);
}
translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
echo("made");
```

#### 17. Video, then Flat model (openscad block)

[Sky.mp4](attachment:sky.mp4)
```openscad
square(20);
translate([30, 10]) circle(8);
```

#### 18. Video, then Broken model (openscad block)

[Sky.mp4](attachment:sky.mp4)
```openscad
cube(10)
sphere(3;
```

#### 19. Video, then 3D model (stl block)

[Sky.mp4](attachment:sky.mp4)
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

#### 20. Video, then Timing diagram (wavedrom block)

[Sky.mp4](attachment:sky.mp4)
```wavedrom
{ signal: [
  { name: "clk", wave: "p.....|..." },
  { name: "data", wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  {},
  { name: "ack", wave: "1.....|01.", node: ".a......b" }
], edge: ["a~>b t1"] }
```

#### 21. Video, then Typing practice (typing block)

[Sky.mp4](attachment:sky.mp4)
```typing
It’s a “fine” day — type it.
function go() {
  return 1;
}
```

#### 22. Video, then Math block

[Sky.mp4](attachment:sky.mp4)
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 23. Video, then Table

[Sky.mp4](attachment:sky.mp4)
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 24. Video, then Table with formulas

[Sky.mp4](attachment:sky.mp4)
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 25. Video, then Hurl entries (hurl block): a capture used by the next entry, and asserts

[Sky.mp4](attachment:sky.mp4)
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

#### 26. Video, then Secret ({{name}}, kept in a locked secrets note)

[Sky.mp4](attachment:sky.mp4)
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 27. Video, then API requests (http block): a variable, a named request and one using its response

[Sky.mp4](attachment:sky.mp4)
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 28. Video, then Spreadsheet (csv block)

[Sky.mp4](attachment:sky.mp4)
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 29. Video, then Named spreadsheet (csv name=), and a formula in another block using it

[Sky.mp4](attachment:sky.mp4)
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 30. Video, then Divider

[Sky.mp4](attachment:sky.mp4)
---

#### 31. Video, then Page breaks (as lines writes them, and as Obsidian and Typora do; a new page in the PDF at each, a gap between pages over a backdrop)

[Sky.mp4](attachment:sky.mp4)
Before the break.

<!-- pagebreak -->
After it, on a new page.

<div style="page-break-after: always"></div>

And another.

#### 32. Video, then Key: Value line

[Sky.mp4](attachment:sky.mp4)
**Wi-Fi password:** correct-horse-battery

#### 33. Video, then Mention

[Sky.mp4](attachment:sky.mp4)
Ask @[QA · Ada] at @[QA · Ada].email.

#### 34. Video, then Wiki link

[Sky.mp4](attachment:sky.mp4)
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 35. Video, then Symbols

[Sky.mp4](attachment:sky.mp4)
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 36. Video, then GitHub links

[Sky.mp4](attachment:sky.mp4)
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 37. Video, then arXiv links

[Sky.mp4](attachment:sky.mp4)
Paper https://arxiv.org/abs/1706.03762 and [a named link](https://arxiv.org/abs/2006.11239)

#### 38. Video, then Image

[Sky.mp4](attachment:sky.mp4)
![A sample picture](attachment:photo.png)

#### 39. Video, then Drawing

[Sky.mp4](attachment:sky.mp4)
![A sample drawing](attachment:drawing.svg)

#### 40. Video, then File

[Sky.mp4](attachment:sky.mp4)
[Budget.csv](attachment:budget.csv)

#### 41. Video, then Attached 3D model (STL)

[Sky.mp4](attachment:sky.mp4)
[Bracket.stl](attachment:bracket.stl)

#### 42. Video, then Terminal recording (.cast file)

[Sky.mp4](attachment:sky.mp4)
[terminal.cast](attachment:terminal.cast)

#### 43. Video, then Audio

[Sky.mp4](attachment:sky.mp4)
[Chime.mp3](attachment:chime.mp3)

#### 44. Video, then Video

[Sky.mp4](attachment:sky.mp4)
[Sky.mp4](attachment:sky.mp4)

#### 45. Video, then Missing file

[Sky.mp4](attachment:sky.mp4)
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 46. Video, then Card

[Sky.mp4](attachment:sky.mp4)
::: card
Text in a card.
:::

#### 47. Video, then Callout (info)

[Sky.mp4](attachment:sky.mp4)
:::i
Text in an info callout.
:::

#### 48. Video, then Callout (warning, chosen icon)

[Sky.mp4](attachment:sky.mp4)
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 49. Video, then Callout (decision, no icon)

[Sky.mp4](attachment:sky.mp4)
:::^ icon=none
Text in a decision callout with no icon.
:::
