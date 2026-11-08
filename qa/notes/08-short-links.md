# QA · Links drawn short

Each kind of GitHub and arXiv link. Check: each one shows as written in code after the arrow, with GitHub's mark or arXiv's graduation cap, and shows its URL while the cursor is on it; ⌘-click opens it. A link with text of its own keeps its text, with the mark in front.

#qa/short-links

#### 1. GitHub: bare URLs

- https://github.com/overtio → `@overtio`
- https://github.com/overtio/lines → `overtio/lines`
- https://github.com/overtio/lines.git → `overtio/lines`
- https://github.com/overtio/lines/issues/12 → `overtio/lines#12`
- https://github.com/overtio/lines/pull/34/files → `overtio/lines#34`
- https://github.com/overtio/lines/discussions/5 → `overtio/lines#5`
- https://github.com/overtio/lines/commit/6781dd7f00ba → `overtio/lines@6781dd7`
- https://github.com/overtio/lines/pull/34/commits/abcdef1234567 → `overtio/lines@abcdef1`
- https://github.com/overtio/lines/tree/main → `overtio/lines@main`
- https://github.com/overtio/lines/releases/tag/v1.0.0 → `overtio/lines@v1.0.0`
- https://github.com/overtio/lines/compare/v1.0...main → `overtio/lines@v1.0...main`
- https://github.com/overtio/lines/blob/main/src/lib/editor/shortLinks.ts#L10-L20 → `overtio/lines › shortLinks.ts:10-20`
- https://github.com/overtio/lines/tree/main/docs → `overtio/lines › docs`
- https://github.com/overtio/lines/actions → `overtio/lines › actions`
- www.github.com/overtio/lines → `overtio/lines`

#### 2. GitHub: other ways of writing them

- <https://github.com/overtio/lines/issues/3> (angle brackets) → `overtio/lines#3`
- [https://github.com/overtio/lines/issues/4](https://github.com/overtio/lines/issues/4) (text is the URL) → `overtio/lines#4`
- [the parser bug](https://github.com/overtio/lines/issues/7) → the mark, then "the parser bug"

#### 3. GitHub: not shortened

- https://github.com stays a plain link
- https://github.com/settings/profile stays a plain link
- https://gist.github.com/overtio/1 stays a plain link
- https://example.com/overtio/lines stays a plain link
- `https://github.com/overtio/lines` in code stays code

#### 4. In a table

| Link | Shows |
| --- | --- |
| https://github.com/overtio/lines/issues/12 | `overtio/lines#12` |
| [docs](https://github.com/overtio/lines/tree/main/docs) | the mark, then docs |
| https://arxiv.org/abs/2006.11239 | `arXiv:2006.11239` |
| [DDPM](https://arxiv.org/abs/2006.11239) | the cap, then DDPM |

#### 5. arXiv: papers

- https://arxiv.org/abs/1706.03762 → `arXiv:1706.03762`
- https://arxiv.org/abs/1706.03762v7 → `arXiv:1706.03762v7`
- https://arxiv.org/pdf/1706.03762v7 → `arXiv:1706.03762v7`
- https://arxiv.org/pdf/2105.05233.pdf → `arXiv:2105.05233`
- https://arxiv.org/html/2401.00001v1 → `arXiv:2401.00001v1`
- https://arxiv.org/abs/hep-th/9901001 → `arXiv:hep-th/9901001`
- https://export.arxiv.org/abs/math.GT/0309136 → `arXiv:math.GT/0309136`
- https://doi.org/10.48550/arXiv.1706.03762 → `arXiv:1706.03762`
- www.arxiv.org/abs/2006.11239 → `arXiv:2006.11239`
- [Attention Is All You Need](https://arxiv.org/abs/1706.03762) → the cap, then "Attention Is All You Need"

#### 6. arXiv: not shortened

- https://arxiv.org stays a plain link
- https://arxiv.org/list/cs.LG/recent stays a plain link
- https://arxiv.org/a/vaswani_a_1 stays a plain link
- https://arxiv.org/abs/not-an-id stays a plain link
- `https://arxiv.org/abs/1706.03762` in code stays code
