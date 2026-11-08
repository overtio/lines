# QA · Right after: Image

Image followed straight away, with no blank line, by each element. Check: nothing overlaps, nothing is cut off, and the space between is even. Markdown joins some pairs without a blank line (text followed by --- is a heading, and a line of text can carry on into the next), so check that what's drawn matches the Markdown.

#qa/adjacent

#### 1. Image, then Paragraph

![A sample picture](attachment:photo.png)
A paragraph with **bold**, *italic*, <u>underlined</u>, ~~struck~~, ==highlighted==, `code`, a [link](https://example.com) and a #qa/tag.

#### 2. Image, then Long paragraph

![A sample picture](attachment:photo.png)
A long paragraph that wraps onto several lines at the usual width, so the space between its lines, its indent on every line, and where it meets the edges of anything around it can be checked. It goes on a little longer to be sure it wraps on a phone too.

#### 3. Image, then Heading 1

![A sample picture](attachment:photo.png)
# Heading one

#### 4. Image, then Heading 2

![A sample picture](attachment:photo.png)
## Heading two

#### 5. Image, then Heading 3

![A sample picture](attachment:photo.png)
### Heading three

#### 6. Image, then Bullet list

![A sample picture](attachment:photo.png)
- First item
- Second item
  - Nested item
    - Third level
- Last item

#### 7. Image, then Numbered list

![A sample picture](attachment:photo.png)
1. First
2. Second
   1. Nested
3. Third

#### 8. Image, then Todo list

![A sample picture](attachment:photo.png)
- [x] Done todo
- [ ] Open todo
  - [ ] Nested open todo

#### 9. Image, then Quote

![A sample picture](attachment:photo.png)
> A quote that runs over
> two lines.

#### 10. Image, then Code block

![A sample picture](attachment:photo.png)
```
plain code
  indented line
```

#### 11. Image, then Code block (TypeScript)

![A sample picture](attachment:photo.png)
```ts
const greeting: string = "hello";
console.log(greeting);
```

#### 12. Image, then JSON block (no language)

![A sample picture](attachment:photo.png)
```
{"name":"lines","tags":["a","b"],"id":12345678901234567890}
```

#### 13. Image, then Diagram

![A sample picture](attachment:photo.png)
```mermaid
flowchart LR
  A[Start] --> B{Choice}
  B --> C[Done]
```

#### 14. Image, then Diagram (240 px wide)

![A sample picture](attachment:photo.png)
```mermaid |240
flowchart LR
  A[Small] --> B[Diagram]
```

#### 15. Image, then 3D model (openscad block), a colored part, an echo

![A sample picture](attachment:photo.png)
```openscad
difference() {
  cube(20, center = true);
  sphere(r = 13);
}
translate([25, 0, 0]) color("tomato") cylinder(h = 10, r = 5);
echo("made");
```

#### 16. Image, then Flat model (openscad block)

![A sample picture](attachment:photo.png)
```openscad
square(20);
translate([30, 10]) circle(8);
```

#### 17. Image, then Broken model (openscad block)

![A sample picture](attachment:photo.png)
```openscad
cube(10)
sphere(3;
```

#### 18. Image, then 3D model (stl block)

![A sample picture](attachment:photo.png)
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

#### 19. Image, then Math block

![A sample picture](attachment:photo.png)
$$
\int_0^1 x^2\,dx = \frac{1}{3}
$$

#### 20. Image, then Table

![A sample picture](attachment:photo.png)
| Left | Center | Right |
| :--- | :----: | ----: |
| a | **b** | 1 |
| longer cell text | `code` | 22 |

#### 21. Image, then Table with formulas

![A sample picture](attachment:photo.png)
| Item | Cost |
| --- | ---: |
| Rent | 1200 |
| Food | 450.50 |
| Total | =SUM(B2:B3) |
| Broken | =B2/0 |

#### 22. Image, then Hurl entries (hurl block): a capture used by the next entry, and asserts

![A sample picture](attachment:photo.png)
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

#### 23. Image, then Secret ({{name}}, kept in a locked secrets note)

![A sample picture](attachment:photo.png)
The token is {{qa-token}}, and {{no-such-secret}} isn't one.

#### 24. Image, then API requests (http block): a variable, a named request and one using its response

![A sample picture](attachment:photo.png)
```http
@api = https://jsonplaceholder.typicode.com

### A todo
# @name todo
GET {{api}}/todos/1

### Its owner
GET {{api}}/users/{{todo.response.body.$.userId}}
```

#### 25. Image, then Spreadsheet (csv block)

![A sample picture](attachment:photo.png)
```csv
Item, Cost
Rent, 1200
Food, 450.50
Total, =SUM(B2:B3)
```

#### 26. Image, then Named spreadsheet (csv name=), and a formula in another block using it

![A sample picture](attachment:photo.png)
```csv name=costs
Item, Cost, Day
Rent, $1200, 2026-01-05
```

```csv
Total, =costs!B2*2
```

#### 27. Image, then Divider

![A sample picture](attachment:photo.png)
---

#### 28. Image, then Key: Value line

![A sample picture](attachment:photo.png)
**Wi-Fi password:** correct-horse-battery

#### 29. Image, then Mention

![A sample picture](attachment:photo.png)
Ask @[QA · Ada] at @[QA · Ada].email.

#### 30. Image, then Wiki link

![A sample picture](attachment:photo.png)
Ask [[QA · Ada]], or [[QA · Ada|her]].

#### 31. Image, then Symbols

![A sample picture](attachment:photo.png)
Home -> cabin <- back, a <-> b, x => y, p <=> q, 1 <= 2 >= 0 != 3. Stays: --> !== \-> and `a -> b` in code.

#### 32. Image, then GitHub links

![A sample picture](attachment:photo.png)
Issue https://github.com/overtio/lines/issues/1 and [a named link](https://github.com/overtio/lines)

#### 33. Image, then Image

![A sample picture](attachment:photo.png)
![A sample picture](attachment:photo.png)

#### 34. Image, then Drawing

![A sample picture](attachment:photo.png)
![A sample drawing](attachment:drawing.svg)

#### 35. Image, then File

![A sample picture](attachment:photo.png)
[Budget.csv](attachment:budget.csv)

#### 36. Image, then Attached 3D model (STL)

![A sample picture](attachment:photo.png)
[Bracket.stl](attachment:bracket.stl)

#### 37. Image, then Terminal recording (.cast file)

![A sample picture](attachment:photo.png)
[terminal.cast](attachment:terminal.cast)

#### 38. Image, then Missing file

![A sample picture](attachment:photo.png)
[Not here yet.pdf](../attachments/00000000000000000000000000000000.pdf)

#### 39. Image, then Card

![A sample picture](attachment:photo.png)
::: card
Text in a card.
:::

#### 40. Image, then Callout (info)

![A sample picture](attachment:photo.png)
:::i
Text in an info callout.
:::

#### 41. Image, then Callout (warning, chosen icon)

![A sample picture](attachment:photo.png)
:::! icon=flag
Text in a warning callout with the flag icon.
:::

#### 42. Image, then Callout (decision, no icon)

![A sample picture](attachment:photo.png)
:::^ icon=none
Text in a decision callout with no icon.
:::
