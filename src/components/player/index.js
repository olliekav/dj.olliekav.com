import { h, Component, Fragment } from 'preact';
import { useState, useContext, useEffect, useReducer } from 'preact/hooks';
import Modal from 'react-modal';
import processString from 'react-process-string';
import withPlayer from '../../contexts/withPlayer';
import { PlayerContext } from '../../contexts/player-context';
import Logo from '../../components/logo';
import Timer from '../../components/player/timer';
import PlayButton from '../../components/player/play-button';
import NextButton from '../../components/player/next-button';
import PrevButton from '../../components/player/prev-button';
import VolumeControl from '../../components/player/volume-control';
import WaveformProgress from '../../components/waveform';
import { slugify } from '../../utilities';

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

  const { player, playPause, playTrackAtIndex, changeVolume, wavesurfer } = useContext(PlayerContext);
  const [modal, setModal] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {
      modalIsOpen: false,
      modalTrack: ''
    }
  );

  useEffect(() => {
    Modal.setAppElement('#app');
  }), [];

  const openModal = (track) => {
    setModal({
      modalIsOpen: true,
      modalTrack: track
    });
  }

  const closeModal = () => {
    setModal({
      modalIsOpen: false,
      modalTrack: ''
    });
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

  const { modalIsOpen, modalTrack } = modal;
  const { currentTrack, wavesurferReady } = player;
  const currentTrackClass = currentTrack ? slugify(currentTrack.title) : '';
  const modalDescription = currentTrack.content.parseURL().parseUsername();

  return (
    <Fragment>
      <div class={'player ' + currentTrackClass}>
        <div class="player-artwork">
          <Logo class="player-artwork-icon"/>
        </div>
        <div class={`player-track-details ${ wavesurferReady ? 'loaded' : ''}`}>
          <h2 class="player-track-title">
            {currentTrack ? currentTrack.title : ''}
          </h2>
          { wavesurferReady ? (
            <Timer />
          ) : (
            <span class="loading-text">
              Buffering
              <span>.</span>
              <span>.</span>
              <span>.</span>
            </span>
          )}
          <button
            class="player-track-info-button"
            onClick={() => openModal(currentTrack)}
            aria-label="Track Info">i</button>
        </div>
        <div class="player-controls">
          <PrevButton onClick={() => prevTrackAtIndex()} />
          <PlayButton onClick={() => playPause()}/>
          <NextButton onClick={() => nextTrackAtIndex()}/>
        </div>
        <WaveformProgress />
        <VolumeControl onChange={() => changeVolume(event.target.value)}/>
      </div>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        class="modal"
        overlayClassName="modal-overlay"
        bodyOpenClassName="modal-body-open"
      >
        <div class="modal-content">
          <h1 class="modal-title">{ currentTrack.title }</h1>
          <div
            class="modal-description"
            dangerouslySetInnerHTML={
              {__html: modalDescription}
            }
          />
          <p class="modal-url">
            <a href={ currentTrack.link } target="_blank">
              View track on Soundcloud
            </a>
          </p>
          <button
            onClick={closeModal}
            class="modal-close"
            aria-label="Close Modal">
            x
          </button>
        </div>
      </Modal>
    </Fragment>
  );
}

export default Player;
