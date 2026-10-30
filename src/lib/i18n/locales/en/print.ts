/** A note as a PDF: its preview, saving and printing it, and what a printed note says. */
export default {
  // The window showing a note laid out on pages.
  "print.title": "PDF Preview",
  "print.close": "Close",
  "print.paper": "Paper",
  "print.a4": "A4",
  "print.letter": "Letter",
  // How a LaTeX note becomes a PDF: by lines itself, or by TeX (a real LaTeX engine).
  "print.typesetter": "Typeset with",
  "print.lines": "lines",
  "print.tex": "TeX",
  "print.pages": "{count, plural, one {# page} other {# pages}}",
  "print.page": "Page {page} of {count}",
  "print.layingOut": "Laying out pages…",
  "print.ready": "{count, plural, one {# page} other {# pages}}, ready",
  // Opens the system's print dialog, which saves PDFs too.
  "print.print": "Print…",
  "print.printHint": "To save a PDF, choose Save as PDF in the print dialog.",
  "print.savePdf": "Save PDF",
  "print.png": "Save PNG",
  "print.pngWhole": "One Image",
  "print.pngWholeHint": "The whole note, top to bottom",
  "print.pngPages": "One per Page",
  "print.pngPagesHint": "{count, plural, one {# image} other {# images, in a ZIP}}",
  "print.makingImages": "Making images…",
  "print.imagesFailed": "The images couldn’t be made.",
  "print.savedTo": "Saved to {path}",
  "print.downloaded": "Downloaded {filename}",
  // TeX: the engine downloads the first time it's used.
  "print.downloading": "Downloading TeX… {percent}%",
  "print.downloadingSize": "The first time only: about 125 MB.",
  "print.compiling": "Typesetting with TeX…",
  "print.texReady": "Typeset with TeX",
  "print.texMissing": "TeX isn't included in this version of lines. Typeset with lines instead.",
  "print.texOffline": "Couldn't download TeX. Check your internet connection and try again.",
  "print.texError": "TeX stopped with an error",
  "print.texErrorAt": "TeX stopped at line {line} of the note",
  "print.log": "TeX's log",
  "print.retry": "Try Again",
  "print.pdfFrame": "{title}, typeset with TeX",
  // A todo on paper, as screen readers say its box.
  "print.done": "Done",
  "print.notDone": "Not done",
  // Headings a printed LaTeX note adds, as LaTeX does.
  "print.abstract": "Abstract",
  "print.references": "References",
  "print.footnotes": "Footnotes",
  // A caption's number: "Figure 2: A sketch."
  "print.figure": "Figure {number}",
  "print.table": "Table {number}",
};
