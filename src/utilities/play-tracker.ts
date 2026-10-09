/**
 * Counts seconds actually listened (ignoring seeks) and fires once when the
 * threshold is crossed, so skimming through a mix doesn't count as a play.
 */
export const createPlayTracker = (thresholdSeconds: number, onPlay: () => void) => {
  let listened = 0;
  let last: number | null = null;
  let reported = false;

  return {
    time(seconds: number) {
      // Small forward steps are playback; anything else is a seek
      if (last !== null && seconds > last && seconds - last < 2) {
        listened += seconds - last;
      }
      last = seconds;
      if (!reported && listened >= thresholdSeconds) {
        reported = true;
        onPlay();
      }
    },
    seek() {
      last = null;
    }
  };
};
