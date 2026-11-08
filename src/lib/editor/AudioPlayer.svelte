<script module lang="ts">
  /** Plays a paused player, or pauses a playing one. */
  export function playOrPause(media: HTMLMediaElement) {
    // play() is refused if a pause comes first, or if the file can't play (which then shows its card): nothing to do.
    if (media.paused) void media.play().catch(() => {});
    else media.pause();
  }
</script>

<script lang="ts">
  // An audio file in a note (media.ts): a card like a file's, its icon a play button, with how far
  // it's played to drag. Styled by editor.css (.cm-lp-audio).
  import { createSubscriber } from "svelte/reactivity";
  import Slider from "../components/ui/Slider.svelte";
  import { t } from "../i18n/index.svelte";
  import Icon from "../icons/Icon.svelte";

  let { audio, name }: { audio: HTMLAudioElement; name: string } = $props();

  const EVENTS = ["play", "pause", "timeupdate", "durationchange", "seeked", "ended", "emptied"];

  /** Follows the audio: on its events, and each frame while it plays, so the position moves smoothly. */
  const subscribe = createSubscriber((update) => {
    let frame = 0;
    const tick = () => {
      update();
      cancelAnimationFrame(frame);
      frame = audio.paused ? 0 : requestAnimationFrame(tick);
    };
    for (const event of EVENTS) audio.addEventListener(event, tick);
    if (!audio.paused) frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      for (const event of EVENTS) audio.removeEventListener(event, tick);
    };
  });

  const playback = {
    get paused() {
      subscribe();
      return audio.paused;
    },
    get time() {
      subscribe();
      return audio.currentTime;
    },
    get duration() {
      subscribe();
      return Number.isFinite(audio.duration) ? audio.duration : 0;
    },
  };

  /** The slider's steps a second: tenths, or whole seconds past ten minutes, to keep their number down. */
  const perSecond = () => (playback.duration > 600 ? 1 : 10);

  /** Where the slider is: always on a step, as the slider moves any other value to one, which would seek the audio. */
  const position = () => Math.floor(playback.time * perSecond()) / perSecond();

  /**
   * Keys in the player, as in a recording's: Space plays and pauses (the button does it itself), and
   * the arrow keys skip a few seconds, on the slider too rather than a step; ⌘ with them goes to the start or end.
   */
  function keys(event: KeyboardEvent) {
    if (event.key === " " && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      return playOrPause(audio);
    }
    const by = ({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 } as Record<string, number>)[event.key];
    if (!by || event.metaKey || !playback.duration) return;
    event.preventDefault();
    event.stopPropagation();
    audio.currentTime = Math.min(Math.max(audio.currentTime + by * Math.min(5, audio.duration / 10), 0), audio.duration);
  }

  /** A time as players write it: 0:42, 3:15, 1:02:07. */
  function clock(seconds: number) {
    const s = Math.floor(seconds);
    const pad = (n: number) => String(n).padStart(2, "0");
    const [hours, minutes] = [Math.floor(s / 3600), Math.floor(s / 60) % 60];
    return hours ? `${hours}:${pad(minutes)}:${pad(s % 60)}` : `${minutes}:${pad(s % 60)}`;
  }

  const action = () => (playback.paused ? t("editor.media.play") : t("editor.media.pause"));
</script>

<span class="cm-lp-file cm-lp-audio" role="group" aria-label={name} onkeydowncapture={keys}>
  <button type="button" class="cm-lp-file-icon cm-lp-audio-play cm-lp-own-input" aria-label={action()} title={action()} onclick={() => playOrPause(audio)}>
    <Icon name={playback.paused ? "play" : "pause"} size={16} strokeWidth={2.25} />
  </button>
  <span class="cm-lp-file-text cm-lp-audio-text">
    <span class="cm-lp-file-name">{name}</span>
    <span class="cm-lp-audio-seek">
      <Slider
        class="cm-lp-own-input cm-lp-audio-slider"
        value={position()}
        min={0}
        max={playback.duration}
        step={1 / perSecond()}
        label={t("editor.media.position")}
        spoken={(time) => t("editor.media.time", { time: clock(time), duration: clock(playback.duration) })}
        oninput={(time) => (audio.currentTime = time)}
        disabled={!playback.duration}
      />
      <span class="cm-lp-file-meta cm-lp-audio-time" aria-hidden="true">
        {playback.duration ? t("editor.media.elapsed", { time: clock(playback.time), duration: clock(playback.duration) }) : clock(playback.time)}
      </span>
    </span>
  </span>
</span>
