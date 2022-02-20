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

  console.log('Rendering');

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
        className="modal"
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M3.61289944,2.20970461 L3.70710678,2.29289322 L12,10.585 L20.2928932,2.29289322 C20.6834175,1.90236893 21.3165825,1.90236893 21.7071068,2.29289322 C22.0675907,2.65337718 22.0953203,3.22060824 21.7902954,3.61289944 L21.7071068,3.70710678 L13.415,12 L21.7071068,20.2928932 C22.0976311,20.6834175 22.0976311,21.3165825 21.7071068,21.7071068 C21.3466228,22.0675907 20.7793918,22.0953203 20.3871006,21.7902954 L20.2928932,21.7071068 L12,13.415 L3.70710678,21.7071068 C3.31658249,22.0976311 2.68341751,22.0976311 2.29289322,21.7071068 C1.93240926,21.3466228 1.90467972,20.7793918 2.20970461,20.3871006 L2.29289322,20.2928932 L10.585,12 L2.29289322,3.70710678 C1.90236893,3.31658249 1.90236893,2.68341751 2.29289322,2.29289322 C2.65337718,1.93240926 3.22060824,1.90467972 3.61289944,2.20970461 Z"></path></svg>
          </button>
        </div>
      </Modal>
    </Fragment>
  );
}

export default Player;
