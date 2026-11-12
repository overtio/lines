# QA · Tags and highlights

Edge cases for tags, highlights and underlines. Check each line against what it says should happen, and the tags in the sidebar under qa.

#qa/tags

#### 1. Tags

- #qa/plain is a tag
- #qa/nested/deeper is a nested tag
- (#qa/in-brackets) is a tag
- #qa/trailing-slash/ is a tag, drawn with its slash, and in the sidebar as qa/trailing-slash (no slash); put the cursor at its end and move away, and the slash goes (⌘Z brings it back)
- #QA/Upper is the same tag as #qa/upper
- #qa/café, #qa/日本 and #qa/हिंदी are tags
- C# is not a tag
- #123 is not a tag
- [a link](#anchor) is not a tag
- `#qa/in-code` is not a tag
- ``#qa/in-double-backticks`` is not a tag
- a tag in a comment, hidden here (<!-- #qa/in-a-comment -->), is not a tag

#### 2. Tags in code blocks

```
#qa/not-a-tag in a code block
```

An indented code block:

    #qa/not-a-tag in an indented code block

#### 3. Highlights

- ==highlighted==
- a == b is not a highlight
- ===three equals=== is not a highlight
- ==highlight across **bold** text==
- == spaced == is not a highlight

#### 4. Underlines

- <u>underlined</u>
- <U>underlined in capitals</U>
- <u>underline across **bold** and ==highlighted== text</u>
- **bold with <u>underlined</u> inside**
- a lone <u> stays as typed
- <u class="x">a tag with an attribute</u> is not an underline
- `<u>in code</u>` is not an underline

#### 5. Tags at the start of a heading

## #qa/heading-start

The heading above reads `#qa/heading-start` as its text, not a tag: no qa/heading-start in the sidebar, as `## ` typed over a heading's text makes it an H2.

## A heading with #qa/heading-later

This heading's tag, later in it, is a tag.
