import { SvelteMap } from "svelte/reactivity";
import { feedStorage, type Position } from "../feeds/storage";
import { t } from "../i18n/index.svelte";
import { attachmentURL } from "../notes/attachments";
import { oneAtATime } from "../playing";
import { PLAYBACK_RATES, type PlaybackRate, prefs } from "../prefs.svelte";
import { announce, windowLabel } from "../windows/channel";

/*
 * The podcast player: one audio element for all of lines, in the main window, so an episode plays
 * on across notes, tabs and views (the mini player shows it, MiniPlayer.svelte); a floating note's
 * Play asks the main window to play it. Where each episode was stopped is kept on this device, by
 * its post's key or its note's id, and it starts again there; one listened to the end, or stopped
 * near it, is played. The episode in the player is kept too, so after the app lock or a restart
 * it's back in the player, paused where it was. The system's media controls (keys, the Mac's Now
 * Playing) drive it through the Media Session API.
 */

/** Something to play: a feed's episode, or an `episode` note's audio. */
export interface Episode {
  /** What its place is kept under. */
  key: string;
  audio: string;
  title: string;
  /** The podcast it's an episode of. */
  show?: string;
  /** Its picture: a feed's, on the web; or a note's cover, an attachment's name. */
  artwork?: string;
  cover?: string;
  /** Its length in seconds, as its feed or note says, until the audio says itself. */
  duration?: number;
  /** Where it opens from the player: its post in the Feeds, or its note. */
  from: { feed: string; post: string } | { note: string };
}

/** How far back and forward the skip buttons go, in seconds. */
export const BACK = 15;
export const FORWARD = 30;
/** How far the position slider's arrow keys go, in seconds. */
export const STEP = 5;
/** How often the place is kept while playing, in milliseconds. */
const KEEP_EVERY = 10_000;
/** Stopped closer than this to the end, in seconds, an episode is played. */
const NEAR_END = 20;

/** An episode's audio as it can be played here: over https, as the apps' web views ask. */
export const playable = (url: string) => url.replace(/^http:\/\//i, "https://");

/** Only the main window plays; the others ask it to. */
const here = windowLabel() === "main";

class Player {
  episode = $state.raw<Episode | null>(null);
  playing = $state(false);
  /** Waiting for the audio to come. */
  loading = $state(false);
  /** Where it's got to, and how long it is, in seconds. */
  time = $state(0);
  duration = $state(0);
  rate = $derived<PlaybackRate>(prefs.playbackRate);
  /** Why the episode couldn't be played, if it couldn't. */
  error = $state<string | null>(null);
  /** Where each episode was stopped, by its key. */
  positions = new SvelteMap<string, Position>();

  #audio: HTMLAudioElement | undefined;
  /** The key of the episode whose audio the element has. */
  #source: string | null = null;
  /** Where to start the audio just given to the element, once it knows how long it is. */
  #startAt = 0;
  /** When the place playing was last kept. */
  #keptAt = 0;
  #loaded: Promise<void> | undefined;
  #onPlayed = new Set<(episode: Episode) => void>();

  /** Reads where episodes were stopped, and puts back the one that was in the player, paused; once. */
  load() {
    this.#loaded ??= feedStorage
      .positions()
      .then(({ positions, inPlayer }) => {
        for (const position of positions) this.positions.set(position.id, position);
        if (!inPlayer || this.episode) return;
        const kept = this.positions.get(inPlayer.key);
        this.episode = inPlayer;
        this.time = kept && !kept.played ? kept.at : 0;
        this.duration = kept?.duration ?? inPlayer.duration ?? 0;
        void this.#metadata();
      })
      .catch((error) => console.error("lines: couldn't read where episodes were stopped", error));
    return this.#loaded;
  }

  get #element() {
    if (this.#audio) return this.#audio;
    const audio = (this.#audio = new Audio());
    audio.preload = "metadata";
    oneAtATime(audio);
    audio.addEventListener("loadedmetadata", () => {
      if (this.#startAt) audio.currentTime = this.#startAt;
      this.#startAt = 0;
    });
    audio.addEventListener("timeupdate", () => {
      // Until it knows the audio, it's at 0, which isn't where the episode was stopped.
      if (!this.#knows()) return;
      this.time = audio.currentTime;
      if (Date.now() - this.#keptAt > KEEP_EVERY) void this.#keep(false);
      this.#position();
    });
    audio.addEventListener("durationchange", () => {
      if (Number.isFinite(audio.duration)) this.duration = audio.duration;
    });
    audio.addEventListener("playing", () => {
      this.playing = true;
      this.loading = false;
    });
    audio.addEventListener("waiting", () => (this.loading = true));
    audio.addEventListener("pause", () => {
      this.playing = this.loading = false;
      // At its end, "ended" comes next, and says so.
      if (!audio.ended) void this.#keep(true);
    });
    audio.addEventListener("ended", () => this.#ended());
    audio.addEventListener("error", () => {
      this.playing = this.loading = false;
      this.error = t("player.couldntPlay");
    });
    // Leaving lines (a tab closed, the app quit) keeps the place it's at.
    addEventListener("pagehide", () => void this.#keep(true));
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && void this.#keep(false));
    this.#mediaSession();
    return audio;
  }

  /** Whether the element knows the audio of the episode in the player, as far as how long it is. */
  #knows() {
    return !!this.#audio && this.#source === this.episode?.key && this.#audio.readyState >= HTMLMediaElement.HAVE_METADATA;
  }

  positionOf(key: string): Position | undefined {
    return this.positions.get(key);
  }

  /** Whether `key`'s episode is the one playing. */
  isPlaying(key: string) {
    return this.playing && this.episode?.key === key;
  }

  /**
   * Plays an episode where it was stopped (from the start if it was played); the one in the player,
   * on from where it is, or again, if it couldn't be. Called straight from a click, as WebKit plays
   * only then. In another window, asks the main window to.
   */
  play(episode: Episode) {
    if (!here) {
      void announce({ type: "play", episode });
      return;
    }
    const audio = this.#element;
    if (this.episode?.key !== episode.key) {
      void this.#keep(true);
      this.episode = episode;
      this.duration = episode.duration ?? 0;
      const kept = this.positions.get(episode.key);
      this.time = kept && !kept.played ? kept.at : 0;
      void feedStorage.putInPlayer(episode).catch((error) => console.error("lines: couldn't keep the episode in the player", error));
      void this.#metadata();
    }
    if (this.#source !== episode.key || this.error) {
      this.#source = episode.key;
      this.error = null;
      this.#startAt = this.time;
      audio.src = playable(episode.audio);
    }
    audio.playbackRate = audio.defaultPlaybackRate = this.rate;
    this.loading = true;
    audio.play().catch((error: Error) => {
      // Paused again before it started is no failure.
      if (error.name === "AbortError") return;
      this.loading = false;
      this.error = t("player.couldntPlay");
      console.warn("lines: couldn't play the episode", error);
    });
  }

  pause() {
    this.#audio?.pause();
    this.loading = false;
  }

  /** Plays `episode` (the one in the player, if none is given), or pauses it if it's playing. */
  toggle(episode = this.episode) {
    if (!episode) return;
    if (this.isPlaying(episode.key)) this.pause();
    else this.play(episode);
  }

  /** Goes to `seconds` into the episode; before its audio has come, it starts there. */
  seek(seconds: number) {
    if (!this.episode) return;
    const to = Math.max(0, Math.min(seconds, this.duration || seconds));
    this.time = to;
    if (this.#knows()) this.#audio!.currentTime = to;
    else this.#startAt = to;
    void this.#keep(false);
  }

  skip(seconds: number) {
    this.seek(this.time + seconds);
  }

  setRate(rate: PlaybackRate) {
    prefs.playbackRate = rate;
    if (this.#audio) this.#audio.playbackRate = this.#audio.defaultPlaybackRate = rate;
    this.#position();
  }

  /** The next speed of PLAYBACK_RATES, round to the first after the last. */
  nextRate(): PlaybackRate {
    return PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(this.rate) + 1) % PLAYBACK_RATES.length];
  }

  /** Stops and puts the player away, keeping the place it was at (unless it's done with). */
  close(keepPlace = true) {
    this.playing = false;
    if (keepPlace) void this.#keep(true);
    this.#audio?.pause();
    this.episode = null;
    this.#source = null;
    this.loading = false;
    this.error = null;
    if (this.#audio) {
      this.#audio.removeAttribute("src");
      this.#audio.load();
    }
    void feedStorage.putInPlayer(null).catch((error) => console.error("lines: couldn't keep the episode in the player", error));
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  }

  /** Marks an episode played, or not. The one in the player, played, is done with: the player closes. */
  setPlayed(key: string, played: boolean) {
    if (played && this.episode?.key === key) this.close(false);
    const was = this.positions.get(key);
    void this.#store({ id: key, at: played ? 0 : (was?.at ?? 0), played, duration: was?.duration });
  }

  /** Keeps where the episode in the player is, now: before lines locks or quits, which stops it. */
  keep(): Promise<void> {
    return this.#keep(true);
  }

  /** Keeps where the episode in the player is; `stopping` it there, near its end, it's played. */
  #keep(stopping: boolean): Promise<void> {
    const episode = this.episode;
    // While its audio is coming, its place is where it was.
    if (!episode || (this.#source === episode.key && !this.#knows())) return Promise.resolve();
    this.#keptAt = Date.now();
    const at = Math.floor(this.time);
    const duration = this.duration || undefined;
    // Near the end, of a short one too: its last tenth.
    if (stopping && duration && at >= duration - Math.min(NEAR_END, duration / 10)) return this.#played(episode);
    const was = this.positions.get(episode.key);
    if (was && was.at === at) return Promise.resolve();
    return this.#store({ id: episode.key, at, played: !!was?.played && !at, duration });
  }

  #store(position: Position): Promise<void> {
    this.positions.set(position.id, position);
    return feedStorage.putPosition(position).catch((error) => console.error("lines: couldn't keep where the episode was", error));
  }

  /** An episode heard to its end: played, from the start next time, and those listening hear of it. */
  #played(episode: Episode): Promise<void> {
    const stored = this.#store({ id: episode.key, at: 0, played: true, duration: this.duration || undefined });
    for (const listener of this.#onPlayed) listener(episode);
    return stored;
  }

  #ended() {
    this.playing = false;
    const episode = this.episode;
    if (!episode) return;
    this.time = 0;
    void this.#played(episode);
  }

  /** Hears of each episode played to its end, or stopped near it. */
  onPlayed(listener: (episode: Episode) => void) {
    this.#onPlayed.add(listener);
    return () => this.#onPlayed.delete(listener);
  }

  /* The system's media controls. */

  #mediaSession() {
    if (!("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ["play", () => this.episode && this.play(this.episode)],
      ["pause", () => this.pause()],
      ["stop", () => this.close()],
      ["seekbackward", (details) => this.skip(-(details.seekOffset ?? BACK))],
      ["seekforward", (details) => this.skip(details.seekOffset ?? FORWARD)],
      ["seekto", (details) => details.seekTime !== undefined && this.seek(details.seekTime)],
      // Keyboards' and headphones' previous and next skip within the episode, as podcast apps do.
      ["previoustrack", () => this.skip(-BACK)],
      ["nexttrack", () => this.skip(FORWARD)],
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // An action this browser doesn't know.
      }
    }
  }

  async #metadata() {
    const episode = this.episode;
    if (!("mediaSession" in navigator) || !episode) return;
    const artwork = episode.artwork ?? (episode.cover && (await attachmentURL(episode.cover)));
    if (this.episode !== episode) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: episode.show ?? "",
      album: episode.show ?? "",
      artwork: artwork ? [{ src: artwork }] : [],
    });
  }

  #position() {
    if (!("mediaSession" in navigator) || !this.duration || this.time > this.duration) return;
    try {
      navigator.mediaSession.setPositionState({ duration: this.duration, position: this.time, playbackRate: this.rate });
    } catch {
      // Not every browser takes it.
    }
  }
}

export const player = new Player();
