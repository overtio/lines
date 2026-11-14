/** The podcast player: the mini player, and playing episodes from the Feeds and from notes. */
export default {
  // The mini player, as screen readers name it.
  "player.label": "Podcast player",
  // Its artwork and title, which open the episode.
  "player.show": "Show the episode",
  "player.close": "Stop and close the player",
  "player.play": "Play",
  "player.pause": "Pause",
  "player.back": "Back {seconds} seconds",
  "player.forward": "Forward {seconds} seconds",
  // Its speed button; {speed} is like 1.5×.
  "player.speed": "Speed: {speed}",
  // The slider of where the episode's got to, and what it says.
  "player.position": "Position in the episode",
  "player.time": "{elapsed} played, {left} left",
  "player.couldntPlay": "This episode couldn’t be played. Play tries again.",
  // A post's and a note's: playing its episode, and whether it was listened to.
  "player.playEpisode": "Play Episode",
  "player.pauseEpisode": "Pause Episode",
  "player.played": "Played",
  "player.left": "{time} left",
  "player.markPlayed": "Mark as Played",
  "player.markUnplayed": "Mark as Unplayed",
  // A time written in a note (`[12:34]`), drawn as a chip that plays the episode from there.
  "player.playFrom": "Play from {time}",
  // Writing the time the player is at, with nothing in it.
  "player.nothingPlaying": "Nothing’s playing: play an episode to write the time it’s at.",
  // The mini player's button that opens the episode's note at its end, with the time, to write in.
  "player.takeNotes": "Take Notes",
  // What screen readers hear when Enter starts a note's next item with the time the episode is at.
  "player.timeWritten": "At {time}",
  // An episode's transcript (and chapters), above the mini player, which its button shows and hides.
  "player.transcript": "Transcript",
  // Puts the sentence playing in the note open, with its time.
  "player.quote": "Quote in Note",
  "player.readingTranscript": "Reading the transcript…",
  "player.transcriptFailed": "The transcript couldn’t be read.",
  "player.transcriptBlocked": "The transcript’s site doesn’t let web pages read it; the apps can.",
  "player.transcriptGone": "The transcript isn’t on its site any more.",
  // Said by screen readers before a chapter's title, among the transcript's lines.
  "player.chapter": "Chapter",
  // Take Notes and Quote in Note, when they can't write in the episode's note, or once it's saved
  // while someone was typing elsewhere (so the cursor isn't taken from them).
  "player.noteTrashed": "The episode’s note is in the Trash.",
  "player.noteLocked": "The episode’s note is locked.",
  "player.couldntSave": "The episode couldn’t be saved to the Library.",
  "player.noteReady": "The episode’s note is ready: Take Notes again to write in it.",
  "player.cantWrite": "This note can’t be written in.",
};
