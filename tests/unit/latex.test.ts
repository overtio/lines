import { expect, test } from "bun:test";
import { scanLatex } from "../../src/plugins/latex/syntax";

test("an \\end with no name yet is a command, even in an environment whose name was deleted", () => {
  // A list whose name was deleted from \begin, then from \end, a character at a time.
  const list = "\\begin{}\n  \\item One\n\\end{itemize}\n\n";
  for (const end of ["\\end{itemiz", "\\end"]) {
    const text = list.replace("\\end{itemize}", end);
    const { spans } = scanLatex(text);
    expect(spans.find((span) => span.type === "env")).toMatchObject({ endFrom: text.length, to: text.length });
    expect(spans.at(-1)).toEqual({ type: "command", from: text.indexOf("\\end"), to: text.indexOf("\\end") + 4 });
  }
});
