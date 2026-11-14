import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState, type TransactionSpec } from "@codemirror/state";
import { stubApp } from "./stubs";

stubApp();
const { fragmentTime, isSoundFile, quoteItem, readStamp, soundOf, stamp, timeEnter, timeIn, timeItem, timeLink } = await import("../../src/lib/player/times");
const { indexAt, readChapters, readTranscript, sentences } = await import("../../src/plugins/feeds/transcripts");
type Cue = Awaited<ReturnType<typeof readTranscript>>[number];

/*
 * Notes while listening, what needs no page: times as they're written in notes and read back, the
 * links to an episode's sound at a time, transcripts (SubRip, WebVTT and JSON; HTML needs the
 * browser's parser: tests/browser/feeds.test.ts) and chapters, and where Take Notes and a quote
 * write. Drawing times as chips and playing from them is in tests/browser/player.test.ts.
 */

describe("times", () => {
  test("are written as the player shows them, to the second they're in, and read back", () => {
    expect(stamp(0)).toBe("0:00");
    expect(stamp(754.9)).toBe("12:34");
    expect(stamp(3723)).toBe("1:02:03");
    for (const seconds of [0, 59, 754, 3599, 3723, 36_000]) expect(readStamp(stamp(seconds))).toBe(seconds);
  });

  test("are read as people write them, and nothing else is", () => {
    expect(readStamp("75:20")).toBe(4520);
    expect(readStamp("01:02:03")).toBe(3723);
    for (const text of ["12:3", "12:60", "1:60:00", "12", "a:bc", "3:16 ", "1:2:3", ""]) expect(readStamp(text)).toBeNull();
  });

  test("in another note are links to the sound at that time, in Media Fragments", () => {
    expect(timeLink("https://traffic.example/e.mp3?u=1", 754.6)).toBe("[12:34](https://traffic.example/e.mp3?u=1#t=754)");
    // A fragment there already is the time's now; an address Markdown would cut short is in <…>.
    expect(timeLink("https://a.example/e.mp3#t=3", 5)).toBe("[0:05](https://a.example/e.mp3#t=5)");
    expect(timeLink("https://a.example/My Show (live).mp3", 5)).toBe("[0:05](<https://a.example/My Show (live).mp3#t=5>)");
  });

  test("are written bare in the episode's own note, and as its link in any other", () => {
    const audio = "https://a.example/e.mp3";
    expect(timeIn(audio, audio, 65)).toBe("[1:05]");
    expect(timeIn("https://a.example/other.mp3", audio, 65)).toBe("[1:05](https://a.example/e.mp3#t=65)");
    expect(timeIn(undefined, audio, 65)).toBe("[1:05](https://a.example/e.mp3#t=65)");
  });

  test("are read from links in each way Media Fragments writes them", () => {
    expect(fragmentTime("https://a.example/e.mp3#t=754")).toBe(754);
    expect(fragmentTime("https://a.example/e.mp3#t=754.5")).toBe(754.5);
    expect(fragmentTime("https://a.example/e.mp3#t=npt:754,800")).toBe(754);
    expect(fragmentTime("https://a.example/e.mp3#t=12:34")).toBe(754);
    expect(fragmentTime("https://a.example/e.mp3#xywh=1,2,3,4&t=1:02:03")).toBe(3723);
    expect(fragmentTime("https://a.example/e.mp3")).toBeNull();
    expect(fragmentTime("https://a.example/page#top")).toBeNull();
    expect(soundOf("https://a.example/e.mp3?x=1#t=5")).toBe("https://a.example/e.mp3?x=1");
  });

  test("play from links to sound files on the web, not to a show's page, nor anything but http(s)", () => {
    expect(isSoundFile("https://dts.podtrac.com/redirect.mp3/traffic.example/e.mp3?u=1")).toBe(true);
    expect(isSoundFile("http://a.example/E.M4A")).toBe(true);
    expect(isSoundFile("https://syntax.fm/1055")).toBe(false);
    for (const href of ["javascript:alert(1)//.mp3", "file:///Users/me/e.mp3", "data:audio/mpeg;base64,AAAA.mp3", "not a link"]) expect(isSoundFile(href)).toBe(false);
  });
});

describe("transcripts", () => {
  /*
   * Fixtures made like each host's files (their quirks kept, their words made up): Buzzsprout's SubRip
   * (spaces before a number, names where the speaker changes, lines wrapped), Omny's WebVTT (a title
   * after WEBVTT, one-digit hours), Podhome's (a NOTE, a voice only where it changes), RedCircle's (no
   * hours, `[SPEAKER_04]:`), Transistor's JSON (times as text) and Buzzsprout's (a word each).
   */
  const fixture = (name: string) => readFileSync(new URL(`./fixtures/listening/${name}`, import.meta.url), "utf8");
  const said = (cues: Cue[]) => cues.map(({ start, speaker, text }) => `${stamp(start)} ${speaker ?? "?"}: ${text}`);

  test("reads SubRip: names written more than once are speakers, on until another's named; lines put together into sentences", () => {
    const cues = readTranscript(fixture("buzzsprout.srt"), "application/x-subrip");
    expect(cues[0]).toEqual({ start: 0.16, end: 3.839, speaker: "Ada Moss", text: "Coming up, why sea turtles come back to the" });
    expect(said(sentences(cues))).toEqual([
      "0:00 Ada Moss: Coming up, why sea turtles come back to the same beach.",
      "0:04 Ben Okafor: With Ada Moss and me, Ben.",
      // "Warning" names no one: it's said once, and it's what's said.
      "0:07 Ben Okafor: Warning: this one is about the sea.",
      // Its markup taken out, its references read (one that's no character as it's written), a bare `<` kept.
      "0:11 Ada Moss: Ben, where do we start? <3 &#99999999; a < b",
      "0:16 Ben Okafor: With the eggs.",
    ]);
  });

  test("reads WebVTT, its voices and its speakers' names", () => {
    expect(said(readTranscript(fixture("omny.vtt"), "text/vtt"))).toEqual([
      "0:01 Speaker 1: Welcome to Tide Tables, a show about the sea.",
      "0:11 Speaker 2: Hey, and welcome to the podcast. I'm Ben, and there's Ada,",
      "0:14 Speaker 2: and this is the turtle episode.",
      "1:02:03 Speaker 1: That's all for today.",
    ]);
    expect(said(sentences(readTranscript(fixture("podhome.vtt"), "text/vtt")))).toEqual(["0:02 Unknown: We are live, I think. Yes.", "0:07 Ada Moss: Excellent.", "0:09 Ada Moss: Okay, so welcome, everybody."]);
    // Labelled as plain text, as some feeds do, it's read as what it is.
    expect(said(readTranscript(fixture("redcircle.vtt"), "text/plain"))).toEqual([
      "0:00 SPEAKER_04: Warning: this episode talks about shipwrecks.",
      "0:06 SPEAKER_04: The books we read are on our site.",
      "0:11 SPEAKER_01: And the links are in the description & the show notes.",
      "0:17 SPEAKER_01: See you next week.",
    ]);
  });

  test("reads Podcasting 2.0's JSON, a sentence at a time or a word", () => {
    expect(said(readTranscript(fixture("transistor.json"), "application/json"))).toEqual([
      "0:00 Ben: Ada, I can't do a podcast with you. We're done. There are gulls in the background.",
      "0:08 Ben: What is going on there?",
      "0:10 Ada: Oh, it's the window. Sorry about the gulls.",
    ]);
    // A pause of more than two seconds ends a sentence too.
    expect(said(sentences(readTranscript(fixture("buzzsprout.json"), "application/json")))).toEqual(["0:00 Ada Moss: Coming up, turtles come home.", "0:04 Announcer: With Ada Moss.", "0:09 Announcer: Later, the news."]);
  });

  test("reads a transcript with no type (an episode note's) as what it looks like", () => {
    expect(readTranscript(fixture("omny.vtt"))).toHaveLength(4);
    expect(readTranscript(fixture("buzzsprout.srt")).length).toBeGreaterThan(0);
    expect(readTranscript(fixture("transistor.json"))).toHaveLength(3);
  });

  test("reads nothing from what isn't a transcript", () => {
    expect(readTranscript("Just words, no times.", "text/plain")).toEqual([]);
    expect(readTranscript("{ not json", "application/json")).toEqual([]);
  });

  test("reads chapters in order, those for the table of contents, with a title; pictures and links only on the web", () => {
    expect(readChapters(fixture("chapters.json"))).toEqual([
      { start: 0, title: "Welcome" },
      { start: 60, title: "Out of order" },
      { start: 245.5, title: "The beach they were born on", image: "https://example.com/beach.jpg", link: "https://example.com/beach" },
      { start: 1830, title: "Magnets" },
    ]);
    expect(readChapters(fixture("captivate-chapters.json")).map((chapter) => chapter.title)).toEqual(["Opening", "Welcome"]);
    expect(readChapters(JSON.stringify({ chapters: [{ startTime: 0, title: "A", img: "javascript:alert(1)", url: "file:///x" }] }))).toEqual([{ start: 0, title: "A" }]);
    expect(readChapters("<html>")).toEqual([]);
  });

  test("finds the line at a time", () => {
    const lines = [{ start: 0 }, { start: 10 }, { start: 20 }];
    expect([-1, 0, 9.9, 10, 25].map((time) => indexAt(lines, time))).toEqual([-1, 0, 0, 1, 2]);
    expect(indexAt([], 5)).toBe(-1);
  });
});

/** A Markdown note, as an editor has it (read as Markdown, for its lists), the cursor at `at`. */
const note = (body: string, at: number) => EditorState.create({ doc: body, selection: { anchor: at }, extensions: markdown() });
/** A note's text, with `|` where the cursor is. */
const shown = (state: EditorState) => `${state.doc.sliceString(0, state.selection.main.head)}|${state.doc.sliceString(state.selection.main.head)}`;

/** A note after `edit`, with `|` where the cursor is; `at` is where the cursor was. */
function edited(body: string, at: number, edit: (state: EditorState) => TransactionSpec) {
  const state = note(body, at);
  return shown(state.update(edit(state)).state);
}

describe("Take Notes", () => {
  const taken = (body: string, time = "[0:12]") => edited(body, 0, (state) => timeItem(state, time));

  test("starts a list of times a blank line below the text, and goes on with it", () => {
    expect(taken("# Episode\n\nWhat it's about.")).toBe("# Episode\n\nWhat it's about.\n\n- [0:12] |");
    expect(taken("# Episode\n\nWhat it's about.\n")).toBe("# Episode\n\nWhat it's about.\n\n- [0:12] |");
    expect(taken("# Episode\n\nAbout.\n\n")).toBe("# Episode\n\nAbout.\n\n- [0:12] |");
    expect(taken("# Episode\n\n- [0:12] Outages", "[0:31]")).toBe("# Episode\n\n- [0:12] Outages\n- [0:31] |");
    expect(taken("# Episode\n\n- [0:12] Outages\n", "[0:31]")).toBe("# Episode\n\n- [0:12] Outages\n- [0:31] |");
  });

  test("starts one left empty again, at the new time, written either way", () => {
    expect(taken("# Episode\n\n- [0:12] Outages\n- [0:31] ", "[0:45]")).toBe("# Episode\n\n- [0:12] Outages\n- [0:45] |");
    const link = "[0:45](https://a.example/e.mp3#t=45)";
    expect(taken("# Notes\n\n- [0:31](https://a.example/e.mp3#t=31) ", link)).toBe(`# Notes\n\n- ${link} |`);
  });

  test("never writes over a last line that isn't a time alone: a reference, a year, a link, what's written after it", () => {
    for (const last of ["- [1](https://example.com/ref)", "- [1]", "- [2024]", "- [0:31](https://example.com/page)", "- [0:31] Outages"]) {
      expect(taken(`# Episode\n\n${last}`, "[0:45]")).toBe(`# Episode\n\n${last}\n- [0:45] |`);
    }
  });
});

describe("Enter in a list of times", () => {
  /** The note after Enter at `at` (its end if not given) as the episode plays at 0:31, `|` where the cursor is; null where Enter is Markdown's own. */
  function entered(body: string, at = body.length) {
    const state = note(body, at);
    const enter = timeEnter(state, "[0:31]");
    return enter && shown(state.update(enter.spec).state);
  }

  test("at an item's end, starts the next with the time the episode is at", () => {
    expect(entered("# Episode\n\n- [0:12] Outages")).toBe("# Episode\n\n- [0:12] Outages\n- [0:31] |");
    expect(entered("- [0:12] Outages\n  * [0:20] nested")).toBe("- [0:12] Outages\n  * [0:20] nested\n  * [0:31] |");
  });

  test("on the last item, with nothing after its time, is Markdown's Enter on an empty item: the list ends, or a nested one moves out a level", () => {
    expect(entered("# Episode\n\n- [0:12] Outages\n- [0:20] ")).toBe("# Episode\n\n- [0:12] Outages\n|");
    expect(entered("- [0:20]")).toBe("|");
    expect(entered("- c\n  - [0:25]")).toBe("- c\n- |");
  });

  test("in the middle of a list keeps a time someone wrote, and goes on after it", () => {
    expect(entered("- [0:12] a\n- [0:20]\n- [0:40] c", 19)).toBe("- [0:12] a\n- [0:20]\n- [0:31] |\n- [0:40] c");
  });

  test("is Markdown's own elsewhere: inside an item, after one with no time, a time that isn't one, or what only looks like an item", () => {
    expect(entered("- [0:12] Outages", 5)).toBeNull();
    expect(entered("- Outages")).toBeNull();
    expect(entered("- [12:3] Outages")).toBeNull();
    expect(entered("Text [0:12] here")).toBeNull();
    // In code, HTML and the note's properties (math is lines' own Markdown: tests/browser/player.test.ts).
    expect(entered("```\n- [0:00] code line", 22)).toBeNull();
    expect(entered("```markdown\n- [0:00] code line\n```", 30)).toBeNull();
    expect(entered("<div>\n- [0:00] html\n</div>", 19)).toBeNull();
    expect(entered("---\ntype: episode\n- [0:00] value\n---\n# Episode", 33)).toBeNull();
  });
});

describe("quotes", () => {
  const quoted = (body: string, at: number, atEnd = false) => edited(body, at, (state) => quoteItem(state, "[1:05]", "Ship it on #friday, *not* Monday.", "Ada", atEnd));
  const QUOTE = "> [1:05] Ship it on \\#friday, \\*not\\* Monday. — Ada";

  test("go after the cursor's line, as text that reads as just that", () => {
    expect(quoted("# Notes\n\nA thought\nMore", 12)).toBe(`# Notes\n\nA thought\n\n${QUOTE}\n\n|\nMore`);
    expect(quoted("# Notes\n\n", 9)).toBe(`# Notes\n\n${QUOTE}\n\n|`);
  });

  test("go at the end of a note just opened, and never into its properties", () => {
    const episode = "---\ntype: episode\naudio: https://a.example/e.mp3\n---\n# Episode\n\nAbout it.";
    expect(quoted(episode, 0, true)).toBe(`${episode}\n\n${QUOTE}\n\n|`);
    // Ending in a line break, a paragraph of its own still, not going on with the text above.
    expect(quoted(`${episode}\n`, 0, true)).toBe(`${episode}\n\n${QUOTE}\n\n|`);
    // The cursor in its properties, as a note opens: still at its end.
    expect(quoted(episode, 4)).toBe(`${episode}\n\n${QUOTE}\n\n|`);
    // A note of properties only: after them.
    expect(quoted("---\ntype: episode\n---", 0)).toBe(`---\ntype: episode\n---\n\n${QUOTE}\n\n|`);
  });
});
