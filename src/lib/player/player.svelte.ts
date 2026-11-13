import { feedStorage, type Position } from "../feeds/storage";
import { t } from "../i18n/index.svelte";
import { PLAYBACK_RATES, type PlaybackRate, prefs } from "../prefs.svelte";

/*
 * The podcast player: one audio element for all of lines, so an episode plays on across notes,
 * tabs and views (the mini player shows it, MiniPlayer.svelte). Where each episode was stopped is
 * kept on this device, by its post's key or its note's audio, and it starts again there; one
 * listened to the end is played. The system's media controls (keys, the Mac's Now Playing) drive
 * it too, through the Media Session API.
 */

/** Something to play: a feed's episode, or an `episode` note's audio. */
export interface Episode {
  /** What its place is kept under. */
  key: string;
  audio: string;
  title: string;
  /** The podcast it's an episode of. */
  show?: string;
  artwork?: string;
  /** Its length in seconds, as its feed or note says, until the audio says itself. */
  duration?: number;
  /** Where it opens from the player: its post in the Feeds, or its note. */
  from: { feed: string; post: string } | { note: string };
}

/** How far back and forward the skip buttons go, in seconds. */
export const BACK = 15;
export const FORWARD = 30;
/** How often the place is kept while playing, in milliseconds. */
const KEEP_EVERY = 10_000;
/** Closer than this to the end, an episode stopped counts as played. */
const NEAR_END = 20;

/** An episode's audio as it can be played here: over https, as the apps' web views ask. */
export const playable = (url: string) => url.replace(/^http:\/\//i, "https://");

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
  positions = $state.raw(new Map<string, Position>());

  #audio: HTMLAudioElement | undefined;
  /** When the place playing was last kept. */
  #keptAt = 0;
  #loaded: Promise<void> | undefined;
  #onPlayed = new Set<(episode: Episode) => void>();

  /** Reads where episodes were stopped, once. */
  load() {
    this.#loaded ??= feedStorage
      .positions()
      .then((all) => {
        this.positions = new Map(all.map((position) => [position.id, position]));
      })
      .catch((error) => console.error("lines: couldn't read where episodes were stopped", error));
    return this.#loaded;
  }

  get #element() {
    if (this.#audio) return this.#audio;
    const audio = (this.#audio = new Audio());
    audio.preload = "metadata";
    audio.addEventListener("timeupdate", () => {
      this.time = audio.currentTime;
      if (Date.now() - this.#keptAt > KEEP_EVERY) this.#keep();
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
      this.playing = false;
      this.#keep();
    });
    audio.addEventListener("ended", () => this.#ended());
    audio.addEventListener("error", () => {
      this.playing = false;
      this.loading = false;
      this.error = t("player.couldntPlay");
    });
    // Leaving lines (a tab closed, the app quit) keeps the place it's at.
    addEventListener("pagehide", () => this.#keep());
    document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && this.#keep());
    this.#mediaSession();
    return audio;
  }

  /** Where `key` was stopped, if it was, and whether it was listened to the end. */
  positionOf(key: string): Position | undefined {
    return this.positions.get(key);
  }

  /**
   * Plays an episode where it was stopped (from the start if it was played); the one playing, on
   * from where it is. Called straight from a click, as WebKit plays only then.
   */
  play(episode: Episode) {
    const audio = this.#element;
    if (this.episode?.key !== episode.key) {
      this.#keep();
      this.episode = episode;
      this.error = null;
      this.duration = episode.duration ?? 0;
      const kept = this.positions.get(episode.key);
      this.time = kept && !kept.played ? kept.at : 0;
      audio.src = playable(episode.audio);
      // The place it was stopped at, once the audio knows how long it is.
      const start = this.time;
      if (start) audio.addEventListener("loadedmetadata", () => (audio.currentTime = start), { once: true });
      this.#metadata();
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
  }

  toggle() {
    if (!this.episode) return;
    if (this.playing) this.pause();
    else this.play(this.episode);
  }

  /** Goes to `seconds` into the episode. */
  seek(seconds: number) {
    const audio = this.#audio;
    if (!audio || !this.episode) return;
    const to = Math.max(0, Math.min(seconds, this.duration || seconds));
    audio.currentTime = this.time = to;
    this.#keep();
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

  /** Stops, keeping the place, and puts the player away. */
  close() {
    this.pause();
    this.#keep();
    this.episode = null;
    if (this.#audio) {
      this.#audio.removeAttribute("src");
      this.#audio.load();
    }
    if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  }

  /** Marks an episode played, or not, keeping where it is otherwise. */
  setPlayed(key: string, played: boolean) {
    const was = this.positions.get(key);
    this.#store({ id: key, at: played ? 0 : (was?.at ?? 0), played, duration: was?.duration });
  }

  /** Keeps where the episode playing is. */
  #keep() {
    const episode = this.episode;
    if (!episode || !this.#audio?.src) return;
    this.#keptAt = Date.now();
    const at = Math.floor(this.time);
    const duration = this.duration || undefined;
    // Stopped all but at the end, it's played.
    const played = !!duration && at >= duration - NEAR_END;
    const was = this.positions.get(episode.key);
    if (was && was.at === at && was.played === played) return;
    this.#store({ id: episode.key, at: played ? 0 : at, played: played || (!!was?.played && !at), duration });
  }

  #store(position: Position) {
    this.positions = new Map(this.positions).set(position.id, position);
    void feedStorage.putPosition(position).catch((error) => console.error("lines: couldn't keep where the episode was", error));
  }

  #ended() {
    this.playing = false;
    const episode = this.episode;
    if (!episode) return;
    this.time = 0;
    this.#store({ id: episode.key, at: 0, played: true, duration: this.duration || undefined });
    for (const listener of this.#onPlayed) listener(episode);
  }

  /** Hears of each episode played to its end. */
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
    ];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
      } catch {
        // An action this browser doesn't know.
      }
    }
  }

  #metadata() {
    const episode = this.episode;
    if (!("mediaSession" in navigator) || !episode) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: episode.title,
      artist: episode.show ?? "",
      album: episode.show ?? "",
      artwork: episode.artwork ? [{ src: episode.artwork }] : [],
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
