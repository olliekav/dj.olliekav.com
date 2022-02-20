import create from 'zustand';

const useStore = create(set => ({
  activeIndex: 0,
  currentTrack: [],
  currentTime: 0,
  duration: 0,
  hasMounted: false,
  isLoaded: false,
  isPlaying: false,
  playlist: [],
  wavesurfer,
  wavesurferReady: false,
  volume: 0.5,
  userInitiated: false
}));

const useStore = create(set => ({
  player: 0,
  setPlaying: () => set((state) => ({ isPlaying: state })),
}))

export const usePlayerStore = useStore;