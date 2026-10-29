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

#### 9. Setext heading

Text followed by dashes
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
