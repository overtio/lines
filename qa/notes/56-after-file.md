# QA · Right after: File

File followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. File, then Paragraph

[Budget.csv](attachment:budget.csv)
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. File, then Long paragraph

[Budget.csv](attachment:budget.csv)
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. File, then Heading 1

[Budget.csv](attachment:budget.csv)
# Heading one

#### 4. File, then Heading 2

[Budget.csv](attachment:budget.csv)
## Heading two

#### 5. File, then Heading 3

[Budget.csv](attachment:budget.csv)
### Heading three

#### 6. File, then Bullet list

[Budget.csv](attachment:budget.csv)
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. File, then Numbered list

[Budget.csv](attachment:budget.csv)
1. First
2. Second
   1. Nested
3. Third

#### 8. File, then Todo list

[Budget.csv](attachment:budget.csv)
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. File, then Quote

[Budget.csv](attachment:budget.csv)
> A quote that runs over
> two lines.

#### 10. File, then Code block

[Budget.csv](attachment:budget.csv)
```
plain code
  indented line
```

#### 11. File, then Code block (TypeScript)

[Budget.csv](attachment:budget.csv)
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. File, then JSON block (no language)

[Budget.csv](attachment:budget.csv)
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. File, then Diagram

[Budget.csv](attachment:budget.csv)
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. File, then Diagram (240 px wide)

[Budget.csv](attachment:budget.csv)
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. File, then 3D model (openscad block), a colored part, an echo

[Budget.csv](attachment:budget.csv)
```openscad
difference() {
  cube(20, center = true);
  sphere(r = 13);
}
translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
echo("made");
```

#### 16. File, then Flat model (openscad block)

[Budget.csv](attachment:budget.csv)
```openscad
square(20);
translate([30, 10]) circle(8);
```

#### 17. File, then Broken model (openscad block)

[Budget.csv](attachment:budget.csv)
```openscad
cube(10)
sphere(3;
```

#### 18. File, then 3D model (stl block)

[Budget.csv](attachment:budget.csv)
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

#### 19. File, then Timing diagram (wavedrom block)

[Budget.csv](attachment:budget.csv)
```wavedrom
{ signal: [
  { name: "clk", wave: "p.....|..." },
  { name: "data", wave: "x.345x|=.x", data: ["head", "body", "tail", "data"] },
  {},
  { name: "ack", wave: "1.....|01.", node: ".a......b" }
], edge: ["a~>b t1"] }
```

#### 20. File, then Math block

[Budget.csv](attachment:budget.csv)
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 21. File, then Table

[Budget.csv](attachment:budget.csv)
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 22. File, then Table with formulas

[Budget.csv](attachment:budget.csv)
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 23. File, then Hurl entries (hurl block): a capture used by the next entry, and asserts

[Budget.csv](attachment:budget.csv)
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

#### 24. File, then Secret ({{name}}, kept in a locked secrets note)

[Budget.csv](attachment:budget.csv)
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 25. File, then API requests (http block): a variable, a named request and one using its response

[Budget.csv](attachment:budget.csv)
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 26. File, then Spreadsheet (csv block)

[Budget.csv](attachment:budget.csv)
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 27. File, then Named spreadsheet (csv name=), and a formula in another block using it

[Budget.csv](attachment:budget.csv)
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 28. File, then Divider

[Budget.csv](attachment:budget.csv)
---

#### 29. File, then Key: Value line

[Budget.csv](attachment:budget.csv)
**Wi-Fi password:** correct-horse-battery

#### 30. File, then Mention

[Budget.csv](attachment:budget.csv)
Ask @[QA · Ada] at @[QA · Ada].email.

#### 31. File, then Wiki link

[Budget.csv](attachment:budget.csv)
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 32. File, then Symbols

[Budget.csv](attachment:budget.csv)
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 33. File, then GitHub links

[Budget.csv](attachment:budget.csv)
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 34. File, then arXiv links

[Budget.csv](attachment:budget.csv)
Paper https://arxiv.org/abs/1706.03762 and [a named link](https://arxiv.org/abs/2006.11239)

#### 35. File, then Image

[Budget.csv](attachment:budget.csv)
![A sample picture](attachment:photo.png)

#### 36. File, then Drawing

[Budget.csv](attachment:budget.csv)
![A sample drawing](attachment:drawing.svg)

#### 37. File, then File

[Budget.csv](attachment:budget.csv)
[Budget.csv](attachment:budget.csv)

#### 38. File, then Attached 3D model (STL)

[Budget.csv](attachment:budget.csv)
[Bracket.stl](attachment:bracket.stl)

#### 39. File, then Terminal recording (.cast file)

[Budget.csv](attachment:budget.csv)
[terminal.cast](attachment:terminal.cast)

#### 40. File, then Audio

[Budget.csv](attachment:budget.csv)
[Chime.mp3](attachment:chime.mp3)

#### 41. File, then Video

[Budget.csv](attachment:budget.csv)
[Sky.mp4](attachment:sky.mp4)

#### 42. File, then Missing file

[Budget.csv](attachment:budget.csv)
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 43. File, then Card

[Budget.csv](attachment:budget.csv)
::: card
Text in a card.
:::

#### 44. File, then Callout (info)

[Budget.csv](attachment:budget.csv)
:::i
Text in an info callout.
:::

#### 45. File, then Callout (warning, chosen icon)

[Budget.csv](attachment:budget.csv)
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 46. File, then Callout (decision, no icon)

[Budget.csv](attachment:budget.csv)
:::^ icon=none
Text in a decision callout with no icon.
:::
