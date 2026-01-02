import { useContext, useState } from 'preact/hooks';
import { PlayerContext } from '../../contexts/player-context';
import Logo from '../../components/logo';
import Timer from '../../components/player/timer';
import PlayButton from '../../components/player/play-button';
import NextButton from '../../components/player/next-button';
import PrevButton from '../../components/player/prev-button';
import PlayerModal from './player-modal';
import VolumeControl from './volume-control';
import WaveformProgress from '../../components/waveform';
import { slugify } from '../../utilities';
import styles from './style.module.scss';

String.prototype.parseURL = function() {
  return this.replace(/[A-Za-z]+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&~\?\/.=]+/g, function( url ) {
    return url.link( url );
  });
};

String.prototype.parseUsername = function() {
  return this.replace(/[@]+[A-Za-z0-9-_]+/g, function( u ) {
    var username = u.replace("@","");
    
    return u.link( 'https://soundcloud.com/' + username );
  });
};

const Player = props => {
  const { player, playPause, playTrackAtIndex, changeVolume } = useContext(PlayerContext);
  const [showModal, setShowModal] = useState(false);

  const openModal = (track) => {
    setShowModal(true);
  }

  const closeModal = () => {
    setShowModal(false);
  }

  const prevTrackAtIndex = () => {
    const prevTrack = player.playlist[player.activeIndex-1];
    const i = player.activeIndex-1;
    playTrackAtIndex(i, prevTrack);
  }

  const nextTrackAtIndex = () => {
    const nextTrack = player.playlist[player.activeIndex+1];
    const i = player.activeIndex+1;
    playTrackAtIndex(i, nextTrack);
  }

  const { currentTrack, wavesurferReady } = player;
  const currentTrackClass = currentTrack ? slugify(currentTrack.title) : '';

  return (
    <>
      <div class={`${styles['player']} ${currentTrackClass}`}>
        <div class={styles['player-artwork']}>
          <Logo class={styles['player-artwork-icon']} />
        </div>
        <div class={`${styles['player-track-details']} ${ wavesurferReady ? 'loaded' : ''}`}>
          <h2 class={styles['player-track-title']}>
            {currentTrack ? currentTrack.title : ''}
          </h2>
          { wavesurferReady ? (
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
            onClick={() => openModal()}
            aria-label="Track Info">i</button>
        </div>
        <div class={styles['player-controls']}>
          <PrevButton onClickCapture={() => prevTrackAtIndex()} />
          <PlayButton onClickCapture={() => playPause()}/>
          <NextButton onClickCapture={() => nextTrackAtIndex()}/>
        </div>
        <div className={styles['player-progress']}>
          <WaveformProgress />
        </div>
        <VolumeControl onChange={() => changeVolume(event.target.value)}/>
      </div>
      <PlayerModal isOpen={showModal} onClose={closeModal}/>
    </>
  );
}

export default Player;
