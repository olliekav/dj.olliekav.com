import { useLocation } from 'preact-iso';
import { useState } from 'preact/hooks';
import { usePlayer } from '../../contexts/player-context';
import playlistStyles from '../../pages/Playlist/style.module.css';
import { mixPath } from '../../utilities/seo';
import { barAccent, themeStyle } from '../../utilities/theme';
import { isPlainClick, routeWithTransition } from '../../utilities/view-transition';
import Logo from '../logo';
import WaveformProgress from '../waveform';
import PlayerModal from './player-modal';
import styles from './style.module.css';
import Timer from './timer';
import { NextButton, PlayButton, PrevButton } from './transport-buttons';
import VolumeControl from './volume-control';

const Player = () => {
  const { state, currentMix } = usePlayer();
  const [showModal, setShowModal] = useState(false);
  const { route } = useLocation();
  const href = currentMix ? mixPath(currentMix) : '/';
  const openMixPage = (event: MouseEvent) => {
    if (isPlainClick(event)) {
      event.preventDefault();
      event.stopPropagation();
      routeWithTransition(route, href);
    }
  };

  return (
    <>
      <div
        class={`${styles['player']} ${playlistStyles['themed']}`}
        style={currentMix ? { ...themeStyle(currentMix.theme), '--mix-accent': barAccent(currentMix.theme) } : undefined}
      >
        {/* The title link is the one for keyboards and screen readers */}
        <a
          class={`${styles['player-artwork']} ${playlistStyles['player-artwork']}`}
          href={href}
          onClick={openMixPage}
          tabIndex={-1}
          aria-hidden="true"
        >
          <Logo />
        </a>
        <div class={`${styles['player-track-details']} ${state.isReady ? 'loaded' : ''}`}>
          <h2 class={styles['player-track-title']}>
            {currentMix ? <a href={href} onClick={openMixPage}>{currentMix.title}</a> : ''}
          </h2>
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
