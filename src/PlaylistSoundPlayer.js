import React, { Component } from 'react';
import Modal from 'react-modal';
import PropTypes from 'prop-types';
import ClassNames from 'classnames';
import { withSoundCloudAudio } from 'react-soundplayer/addons';
import {
  PlayButton,
  PrevButton,
  NextButton,
  Progress,
  Timer,
  VolumeControl
} from 'react-soundplayer/components';
import { ReactComponent as Logo } from './logo.svg'
import './PlaylistSoundPlayer.scss';

Modal.setAppElement('#root');

const processString = require('react-process-string');
/*eslint-disable */
let processStringConfig = [{
  regex: /(http|https):\/\/(\S+)\.([a-z]{2,}?)(.*?)( |\,|$|\.)/gim,
  fn: (key, result) => (
    <span key={key}>
      <a 
        target="_blank"
        rel="noopener noreferrer"
        href={`${result[1]}://${result[2]}.${result[3]}${result[4]}`}>
          {result[2]}.{result[3]}{result[4]}
        </a>
        {result[5]}
    </span>
  )
}, {
  regex: /(\S+)\.([a-z]{2,}?)(.*?)( |\,|$|\.)/gim,
  fn: (key, result) => (
    <span key={key}>
      <a
        target="_blank"
        rel="noopener noreferrer"
        href={`http://${result[1]}.${result[2]}${result[3]}`}>
          {result[1]}.{result[2]}{result[3]}
        </a>
        {result[4]}
    </span>
  )
}];
/*eslint-enable */

class PlaylistSoundPlayer extends Component {
  constructor() {
    super();

    this.state = {
      activeIndex: 0,
      modalIsOpen: false,
      modalTrack: ''
    };

    this.onAudioEnded =  this.onAudioEnded.bind(this)
  }

  componentDidMount() {
    const { soundCloudAudio } = this.props;
    soundCloudAudio._playlistIndex = 0;
    soundCloudAudio.on('ended', () => this.onAudioEnded());
  }

  onAudioEnded() {
    const { soundCloudAudio } = this.props;
    soundCloudAudio && soundCloudAudio.play({ playlistIndex: soundCloudAudio._playlistIndex+1 });
  }

  /*eslint-disable */
  slugify = (text) => {
    return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
  }
  /*eslint-enable */

  afterOpenModal = () => {
    
  }

  openModal = (track) => {
    this.setState({
      modalIsOpen: true,
      modalTrack: track
    });
  }

  closeModal = () => {
    this.setState({modalIsOpen: false});
  }

  playTrackAtIndex = (playlistIndex, track) => {
    const { soundCloudAudio } = this.props;

    this.setState({
      activeIndex: playlistIndex
    });

    soundCloudAudio.play({ playlistIndex });
    
  }

  nextIndex = (event) => {
    const { playing, playlist, soundCloudAudio } = this.props;
    let { activeIndex } = this.state;

    if (activeIndex >= playlist.tracks.length - 1) {
      return;
    }

    if (activeIndex || activeIndex === 0) {
      this.setState({activeIndex: ++activeIndex});
      if(playing) {
        soundCloudAudio.next();
      } else {
        soundCloudAudio._playlistIndex = ++soundCloudAudio._playlistIndex;
      }
    }
  }

  prevIndex = () => {
    const { playing, soundCloudAudio } = this.props;
    let { activeIndex } = this.state;

    if (activeIndex <= 0) {
      return;
    }

    if (activeIndex || activeIndex === 0) {
      this.setState({activeIndex: --activeIndex});

      if(playing) {
        soundCloudAudio.prev();
      } else {
        soundCloudAudio._playlistIndex = --soundCloudAudio._playlistIndex;
      }
    }
  }

  renderTrackList() {
    const { playlist } = this.props;

    const tracks = playlist.tracks.map((track, i) => {
      const classNames = ClassNames('playlist-track-button', {
        'active-track': this.props.soundCloudAudio._playlistIndex === i
      });

      const trackTitle = this.slugify(track.title);

      return (
        <div 
          key={track.id}
          className={'playlist-track ' + trackTitle}>
          <button
            className={classNames}
            onClick={() => this.playTrackAtIndex(i, track)}>
            <Logo className="playlist-track-icon"/>
            <h2 className="playlist-track-title">#{i+1}</h2>
            <span className="playlist-track-time">{Timer.prettyTime(track.duration / 1000)}</span>
            <span className="playlist-track-genre">{track.genre}</span>
          </button>
        </div>
      );
    });

    return (
      <div className="playlist">{tracks}</div>
    );
  }

  render() {
    let { playlist, currentTime, duration, soundCloudAudio } = this.props;
    const { modalTrack } = this.state;
    const currentTrack = playlist ? playlist.tracks[soundCloudAudio._playlistIndex] : '';
    const currentTrackClass = currentTrack ? this.slugify(currentTrack.title) : '';
    const waveFormUrl = currentTrack ? currentTrack.waveform_url : '';
    const modalDescription = processString(processStringConfig)(modalTrack.description);

    if (!playlist) {
      return (
        <div className="loader">
          <div className="rect1"></div>
          <div className="rect2"></div>
          <div className="rect3"></div>
          <div className="rect4"></div>
          <div className="rect5"></div>
          <span>Loading...</span>
        </div>
      )
    }

    return (
      <div className="wrapper loaded">
        {this.renderTrackList()}
        <div className={'player ' + currentTrackClass}>
          <div className="player-artwork">
            <Logo className="player-artwork-icon"/>
          </div>
          <div className="player-track-details">
            <h2 className="player-track-title">{currentTrack ? currentTrack.title : ''}</h2>
            <Timer duration={currentTrack ? currentTrack.duration / 1000 : 0} currentTime={currentTime} />
            <button className="player-track-info-button" onClick={() => this.openModal(currentTrack)} aria-label="Track Info">i</button>
          </div>
          <div className="player-controls">
            <PrevButton
              className="player-control"
              onPrevClick={this.prevIndex} />
            <PlayButton
              className="player-control"
              {...this.props} />
            <NextButton
              className="player-control"
              onNextClick={this.nextIndex} />
          </div>
          <div className="player-progress">
            <Progress
              className="player-progress-wrapper"
              innerClassName="player-progress-bar"
              value={(currentTime / duration) * 100 || 0}
              {...this.props} />
            <div
              className="player-waveform"
              style={{ backgroundImage: `url(${waveFormUrl})` }} />
          </div>
          <div className="player-volume">
            <VolumeControl
              className='player-volume-wrapper'
              buttonClassName="player-control"
              {...this.props} />
          </div>
        </div>
        <Modal
          isOpen={this.state.modalIsOpen}
          onRequestClose={this.closeModal}
          className="modal"
          overlayClassName="modal-overlay"
          bodyOpenClassName="modal-body-open"
        >
          <div className="modal-content">
            <h1 className="modal-title">{ modalTrack.title }</h1>
            <pre className="modal-description">{ modalDescription }</pre>
            <p className="modal-url"><a href={ modalTrack.permalink_url }>View track on Soundcloud</a></p>
            <button onClick={this.closeModal} className="modal-close" aria-label="Close Modal">x</button>
          </div>
        </Modal>
      </div>
    );
  }
}

PlaylistSoundPlayer.propTypes = {
  resolveUrl: PropTypes.string.isRequired,
  clientId: PropTypes.string.isRequired
};

export default withSoundCloudAudio(PlaylistSoundPlayer);