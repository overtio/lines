# QA · Mentions

Mentions of other notes and their properties. Check each line against what it says should happen. ⌘-click a chip or a value to open its note; with the cursor on a mention it shows as written.

#qa/objects

#### 1. Mentions

- @[QA · Ada] is a chip with its type's icon and "QA · Ada"
- @[qa · ada] and @[QA  ·  Ada] are the same chip (case and spaces don't matter)
- @[QA · Company] has the icon of its type, qa-company

#### 2. Properties

- @[QA · Ada].fullname reads "Ada Lovelace", underlined
- @[QA · Ada].born_on and @[QA · Ada].bornOn both read "10 December 1815" (the key is "Born on")
- @[QA · Ada].employer reads "QA · Company"
- @[QA · Ada].languages reads "English, French"
- @[QA · Ada].motto reads without its quotes

#### 3. Not found

- @[No such note] stays as written, grey with a dashed underline; hovering it offers to create it (don't, so the line stays a test)
- @[QA · Ada].phone stays as written: Ada has no phone

#### 4. Not mentions

- ada@example.org is an email address
- overtio/lines@main is not a mention
- \@[QA · Ada] (escaped) stays text
- `@[QA · Ada]` in code stays code
- A sentence ending after @[QA · Ada]. The full stop isn't a property: typing it opens the properties menu, and Enter then starts a new line.

#### 5. Type tables

Every note of the type qa-person, with every property:

@type.qa-person

Just two columns:

@type.qa-person(fullname, email)

A type with no notes:

@type.qa-nothing

Within text, @type.qa-person is a chip.

#### 6. Typing

Type @ and a letter on the line below: a menu of notes opens, with types on the right. Enter or Tab writes the mention. Then type . for a menu of its properties.



#### 7. Wiki links

- [[QA · Ada]] is the same chip as @[QA · Ada]
- [[QA · Ada|her]] reads "her", with Ada's icon; hovering it shows "QA · Ada"
- [[QA · Ada#Born]] is Ada's chip (the heading is read past)
- [[No such note]] stays as written, grey with a dashed underline, and offers to create it on hover (don't)
- ![[QA · Ada]] (an embed) and \[[QA · Ada]] (escaped) stay text

| In a table | Its bar escaped |
|---|---|
| [[QA · Ada\|her]] | reads "her", with Ada's icon, the table's columns as they are |

Type two opening square brackets on the line below: the menu of notes opens at once, and Enter writes the wiki link.
