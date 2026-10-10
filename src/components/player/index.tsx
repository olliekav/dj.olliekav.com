import { useState } from 'preact/hooks';
import { usePlayer } from '../../contexts/player-context';
import playlistStyles from '../../pages/Playlist/style.module.scss';
import { themeStyle } from '../../utilities/theme';
import Logo from '../logo';
import WaveformProgress from '../waveform';
import PlayerModal from './player-modal';
import styles from './style.module.scss';
import Timer from './timer';
import { NextButton, PlayButton, PrevButton } from './transport-buttons';
import VolumeControl from './volume-control';

const Player = () => {
  const { state, currentMix } = usePlayer();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div class={`${styles['player']} ${playlistStyles['themed']}`} style={themeStyle(currentMix?.theme)}>
        <div class={`${styles['player-artwork']} ${playlistStyles['player-artwork']}`}>
          <Logo />
        </div>
        <div class={`${styles['player-track-details']} ${state.isReady ? 'loaded' : ''}`}>
          <h2 class={styles['player-track-title']}>{currentMix?.title ?? ''}</h2>
          {state.isReady ? (
            <Timer />
          ) : (
            <span class={styles['loading-text']}>
              Buffering
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          )}
          <button
            class={styles['player-track-info-button']}
            onClick={() => setShowModal(true)}
            aria-label="Mix info">i</button>
        </div>
        <div class={styles['player-controls']}>
          <PrevButton />
          <PlayButton />
          <NextButton />
        </div>
        <div class={styles['player-progress']}>
          <WaveformProgress />
        </div>
        <VolumeControl />
      </div>
      <PlayerModal isOpen={showModal} onClose={() => setShowModal(false)} />
    </>
  );
};

export default Player;
