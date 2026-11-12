# Objects and mentions

A note can be an object: a person, a company, a project, a book. Give it properties at the very top, between two `---` lines, with a `type`:

```markdown
---
type: person
born: 10 December 1815
known for: The first computer program
---
# Ada Lovelace
```

The next note, @[Ada Lovelace], is one. Its type puts it under **Types → Person** in the sidebar, and right-click a type there to give it an icon and a color. A new note made under a type starts as one of that type.

## On the Calendar

A `date` or `due` property puts a note on that day in the **Calendar** in the sidebar, and a `start` and `end` on every day between. Write the date as `2026-11-30`, with a time after it if you like (`2026-11-30 14:00`), and the week and day there show the note at that time. Drag down the hours there to make an event, or across All day for whole days, or drag one to move it. Choose a day to list its notes, or press ↵ on a day for a note dated that day. Events take their type's or tag's color, or one of their own: right-click a note in the list → Icon and Color. A `repeat` property makes one come round again (`repeat: every monday and thursday`), or right-click it there → Repeat.

## Mentions

Type `@` and a letter to mention any note by its title. The mention reads as the note's title, with its icon; ⌘-click it to open the note. Wiki links work too, as in Obsidian: type `[[` for the same menu, and [[Ada Lovelace|a link with its own text]] shows that text instead.

Add `.` and a property to show its value: Ada was born on @[Ada Lovelace].born and is known for @[Ada Lovelace].known_for. Change a value in her note and it changes here.

## Tables of a type

`@type.person` on a line of its own is a table of every note of that type, with a column for each property:

@type.person

Hover a column's name to remove it, or click **+** to add one; the line keeps the columns chosen, like `@type.person(born, field)`. Click a column to sort by it, and **New Person** to add one. Type `/type table` to make one.

- [ ] Type `/properties` at the end of this note to give it a type
- [ ] Mention another note in this list with `@`

#tour
