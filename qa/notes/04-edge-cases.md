# QA · Edge cases

Unusual but valid Markdown. Check each against what it says should happen.

#qa/edge-cases

#### 1. Four colons

:::: card
A card opened with four colons and closed with three.
:::

#### 2. Name with a colon: not a card

::: note: this
This line and the fence above are plain text.

#### 3. Empty card

::: card
:::

#### 4. Card right after a code block

```
code
```
::: card
The card leaves a gap above it.
:::

#### 5. Cards touching

::: card
First.
:::
::: card
Second, with a gap between.
:::

#### 6. Image inside a line of text

Text with ![a picture](attachment:photo.png) inside it.

#### 7. Picture from the web

![A memo emoji](https://github.githubassets.com/images/icons/emoji/unicode/1f4dd.png)

#### 8. Empty lines between paragraphs

One.



Two, after three empty lines.

#### 9. Dashes under text: a divider, the text a paragraph (both lines a heading with Settings → Editor → Underlined headings on)

Text on two lines,
followed by dashes
---

#### 10. Hard line break

Line with two trailing spaces  
next line.

#### 11. HTML

<b>HTML is shown as text</b>

#### 12. Fence in a code block in a card

::: card
```
:::
```
The ::: in the code above doesn't close the card; this line is still in it.
:::

#### 13. Three cards closing on three lines, after a code block in a language not loaded yet

```haskell
main = putStrLn "hello"
```

::: card
:::!
:::i
Three cards, each inside the last. Check all three close here, and the next heading is outside them.
:::
:::
:::

#### 14. After the cards above

This line is outside every card.

#### 15. Photo from Unsplash, by the link to its page

![Snow-covered mountain peak](https://unsplash.com/photos/snow-covered-mountain-peak-illuminated-by-sunset-light-mevyYnC5xCo)

#### 16. Unsplash photo inside a line of text

A mountain ![ice-capped mountain](https://unsplash.com/photos/xfngap_DToE) inside a line.

#### 17. Dollars that aren't math

- $5 and $10 stay text (a space before the second $, a digit after it).
- An escaped \$x\$ stays text.
- `$x$` in code stays code.

#### 18. Math that isn't Markdown

$a_1 * b_2 * c_3$ is math, with no italics.

#### 19. Display math within a paragraph

The Basel problem: $$\sum_{n=1}^\infty \frac{1}{n^2} = \frac{\pi^2}{6}$$ centered on a line of its own.

#### 20. LaTeX that KaTeX can't read

Shown red, as written, with the reason on hover: $\frac{1}{$

$$
\begin{matrix} a
$$

#### 21. Math code block

```math
\begin{aligned}
a &= b + c \\
d &= e
\end{aligned}
```

#### 22. Empty math block

$$
$$

#### 23. A line of only # or -

#

-

The # and the - above are text, not an empty heading and list item: a tag and a list item are typed this way.

#### 24. Recording from asciinema.org, by its embed code

[![asciicast](https://asciinema.org/a/1271559.svg)](https://asciinema.org/a/1271559)

#### 25. asciinema's preview alone plays too

![asciicast](https://asciinema.org/a/1271559.png)

#### 26. Starting at 0:10, twice as fast

[![asciicast](https://asciinema.org/a/1271559.svg)](https://asciinema.org/a/1271559?t=0:10&speed=2)

#### 27. Recordings that stay links

[A recording's page](https://asciinema.org/a/1271559) and [terminal.cast](attachment:terminal.cast) within a line of text are links.
