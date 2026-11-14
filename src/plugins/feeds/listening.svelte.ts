/** The Feeds plugin's part of the podcast player: whether the transcript shows above it, and Take Notes under way. */
class Listening {
  transcript = $state(false);
  taking = $state(false);
}

export const listening = new Listening();

/** The transcript's element, which its button controls. */
export const TRANSCRIPT_ID = "player-transcript";
