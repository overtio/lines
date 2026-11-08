// With the app's own styles: added once a recording first shows, a stylesheet restyles the whole
// page, a stall that shows while scrolling.
import "asciinema-player/dist/bundle/asciinema-player.css";
import { t } from "../../lib/i18n/index.svelte";
import type { Embed, FileView, Plugin } from "../../lib/plugins/types";
import { fetchCast, playRecording } from "./player";
import { embedCode, recordingSource } from "./recordings";

/*
 * asciinema: terminal recordings in Markdown notes, played in place. asciinema.org's embed code
 * (its preview, linked to the recording) is drawn as the recording's player, and an attached .cast
 * file shows its player above its card. Other apps show the preview, or the file's link.
 */

const recordingFiles: FileView = {
  id: "asciinema",
  extensions: ["cast"],
  show: (dom, file) => playRecording(dom, () => file.data.text()),
};

const asciinemaRecordings: Embed = {
  id: "asciinema",
  draws: (link) => !!recordingSource(link),
  draw(dom, link, changed) {
    const { url, ...options } = recordingSource(link)!;
    return playRecording(dom, () => fetchCast(url), options, changed);
  },
  paste: embedCode,
};

export const asciinema = (): Plugin => ({
  id: "asciinema",
  name: "asciinema",
  description: t("plugins.asciinema.description"),
  icon: "terminal",
  enabledByDefault: true,
  contributes: {
    files: [recordingFiles],
    markdown: [{ embeds: [asciinemaRecordings] }],
  },
});
