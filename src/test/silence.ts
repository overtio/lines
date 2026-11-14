/*
 * Builds made for the browser tests and the QA pictures (`--mode test`) make no sound: a browser out
 * of sight still plays through the computer's speakers, and a test's beep or an episode playing
 * would reach whoever is at it. What plays still plays (its time moves, its events fire), unheard:
 * a sound or video is muted as it starts, and Web Audio goes to the speakers through a gain of 0.
 */

const play = HTMLMediaElement.prototype.play;
HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
  this.muted = true;
  return play.call(this);
};

const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
const silent = new WeakMap<BaseAudioContext, GainNode>();
AudioNode.prototype.connect = function (this: AudioNode, target: unknown, ...rest: unknown[]) {
  if (!(target instanceof AudioDestinationNode)) return connect.call(this, target, ...rest);
  let quiet = silent.get(target.context);
  if (!quiet) {
    quiet = target.context.createGain();
    quiet.gain.value = 0;
    connect.call(quiet, target);
    silent.set(target.context, quiet);
  }
  return connect.call(this, quiet, ...rest);
} as typeof AudioNode.prototype.connect;
