import { h, Component, Fragment } from 'preact';
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

class Player extends Component {
  
  constructor() {
    super();
    this.state = {
      modalIsOpen: false,
      modalTrack: ''
    };
  }

  componentDidMount() {
    Modal.setAppElement('#app');
  }

  openModal = (track) => {
    this.setState({
      modalIsOpen: true,
      modalTrack: track
    });
  }

  closeModal = () => {
    this.setState({ 
      modalIsOpen: false,
      modalTrack: ''
    });
  }

  playPause = () => {
    const { playPause } = this.props.context;
    playPause();
  }

  prevTrackAtIndex = () => {
    const { activeIndex, playlist, playTrackAtIndex } = this.props.context;
    const prevTrack = playlist[activeIndex-1];
    const i = activeIndex-1;
    playTrackAtIndex(i, prevTrack);
  }

  nextTrackAtIndex = () => {
    const { activeIndex, playlist, playTrackAtIndex } = this.props.context;
    const nextTrack = playlist[activeIndex+1];
    const i = activeIndex+1;
    playTrackAtIndex(i, nextTrack);
  }

  changeVolume = (event) => {
    const { changeVolume } = this.props.context;
    changeVolume(event.target.value);
  }

  render(props, state) {
    const { activeIndex, currentTrack, wavesurfer, wavesurferReady } = props.context;
    const { modalTrack } = state;
    const currentTrackClass = currentTrack ? slugify(currentTrack.title) : '';
    console.log(currentTrack.content);
    const modalDescription = currentTrack.content.parseURL().parseUsername();
    return (
      <Fragment>
        <div class={'player ' + currentTrackClass}>
          <div class="player-artwork">
            <Logo class="player-artwork-icon"/>
          </div>
          <div class="player-track-details">
            <h2 class="player-track-title">{currentTrack ? currentTrack.title : ''}</h2>
            { wavesurferReady ? (
              <Timer />
            ) : (
              <Fragment>Buffering...</Fragment>
            )}
            <button
              class="player-track-info-button"
              onClick={() => this.openModal(currentTrack)}
              aria-label="Track Info">i</button>
          </div>
          <div class="player-controls">
            <PrevButton onClick={() => this.prevTrackAtIndex()} />
            <PlayButton onClick={() => this.playPause()}/>
            <NextButton onClick={() => this.nextTrackAtIndex()}/>
          </div>
          <WaveformProgress waveformChildRef={props.waveformChildRef}/>
          <VolumeControl onChange={() => this.changeVolume(event)}/>
        </div>
        <Modal
          isOpen={this.state.modalIsOpen}
          onRequestClose={this.closeModal}
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
              onClick={this.closeModal}
              class="modal-close"
              aria-label="Close Modal">
              x
            </button>
          </div>
        </Modal>
      </Fragment>
    );
  }
}

export default withPlayer(Player);