export const BAR_WIDTH = 4;
/** Wavesurfer's default gap: half a bar, after each bar */
const BAR_GAP = BAR_WIDTH / 2;
const SLOT = BAR_WIDTH + BAR_GAP;

/**
 * Wavesurfer fits whole bars from the left, leaving the remainder (and the last gap) on the
 * right. Size its container to whole bars and offset it so the bars sit centred in `available`.
 */
export const barsLayout = (available: number) => {
  const bars = Math.floor((available + BAR_GAP) / SLOT);
  if (bars < 1) {
    return { width: 0, offset: 0 };
  }
  return { width: bars * SLOT, offset: (available - (bars * SLOT - BAR_GAP)) / 2 };
};
