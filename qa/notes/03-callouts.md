# QA · Callouts

Every kind of callout, every way of writing one, nested and touching. Check: the color and icon of each kind, the icon level with the first line, text clear of the icon, nothing spilling out of a callout, and the Markdown showing when the cursor is on a fence. Click an icon: the picker opens, and choosing an icon, No Icon or Reset rewrites that callout's first line.

#qa/callouts

#### 1. info: short name, default icon

:::i
An info callout written `:::i`.
:::

#### 2. info: long name with a space

::: info
An info callout written `::: info`.
:::

#### 3. info: upper case

:::INFO
An info callout written in capitals.
:::

#### 4. info: chosen icon

:::i icon=rocket
An info callout with the rocket icon.
:::

#### 5. info: no icon

:::i icon=none
An info callout with no icon. The text starts at the card's edge.
:::

#### 6. question: short name, default icon

:::?
A question callout written `:::?`.
:::

#### 7. question: long name with a space

::: question
A question callout written `::: question`.
:::

#### 8. question: upper case

:::QUESTION
A question callout written in capitals.
:::

#### 9. question: chosen icon

:::? icon=rocket
A question callout with the rocket icon.
:::

#### 10. question: no icon

:::? icon=none
A question callout with no icon. The text starts at the card's edge.
:::

#### 11. warning: short name, default icon

:::!
A warning callout written `:::!`.
:::

#### 12. warning: long name with a space

::: warning
A warning callout written `::: warning`.
:::

#### 13. warning: upper case

:::WARNING
A warning callout written in capitals.
:::

#### 14. warning: chosen icon

:::! icon=rocket
A warning callout with the rocket icon.
:::

#### 15. warning: no icon

:::! icon=none
A warning callout with no icon. The text starts at the card's edge.
:::

#### 16. error: short name, default icon

:::!!!
An error callout written `:::!!!`.
:::

#### 17. error: long name with a space

::: error
An error callout written `::: error`.
:::

#### 18. error: upper case

:::ERROR
An error callout written in capitals.
:::

#### 19. error: chosen icon

:::!!! icon=rocket
An error callout with the rocket icon.
:::

#### 20. error: no icon

:::!!! icon=none
An error callout with no icon. The text starts at the card's edge.
:::

#### 21. decision: short name, default icon

:::^
A decision callout written `:::^`.
:::

#### 22. decision: long name with a space

::: decision
A decision callout written `::: decision`.
:::

#### 23. decision: upper case

:::DECISION
A decision callout written in capitals.
:::

#### 24. decision: chosen icon

:::^ icon=rocket
A decision callout with the rocket icon.
:::

#### 25. decision: no icon

:::^ icon=none
A decision callout with no icon. The text starts at the card's edge.
:::

#### 26. Unknown icon name: the kind's own icon

:::! icon=no-such-icon
Shows the warning triangle.
:::

#### 27. Unknown kind: a plain card

:::tip
A plain card, not a callout.
:::

#### 28. Two exclamation marks: a plain card

:::!!
A plain card, not a callout.
:::

#### 29. Several paragraphs

:::i
First paragraph.

Second paragraph, after a blank line.

Third paragraph.
:::

#### 30. Starts with a heading

:::!
## A heading first
The icon lines up with the heading's first line.
:::

#### 31. Starts with a list

:::^
- First item
- Second item
:::

#### 32. Starts with a table

:::i
| A | B |
| --- | --- |
| 1 | 2 |
:::

#### 33. Starts with a code block

:::!!!
```
error: something broke
```
:::

#### 34. Empty

:::?
:::

#### 35. Callout in a callout

:::i
Outer callout.

:::!
Inner callout, inset inside the outer one with its own icon column.
:::

Back in the outer one.
:::

#### 36. Card in a callout

:::^
A callout with a card inside.

::: card
The card.
:::
:::

#### 37. Callout in a card

::: card
A card with a callout inside.

:::?
The callout.
:::
:::

#### 38. Three callouts touching, no blank lines

:::i
First.
:::
:::!
Second.
:::
:::^
Third.
:::

#### 39. Very long word

:::!
Supercalifragilisticexpialidocious-and-then-some-more-text-without-any-spaces-to-break-at-all-anywhere
:::

#### 40. Wide table

:::i
| One | Two | Three | Four | Five | Six | Seven | Eight |
| --- | --- | --- | --- | --- | --- | --- | --- |
| a long cell | another long cell | more | more | more | more | more | more |
:::
