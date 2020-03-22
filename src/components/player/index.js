import { h, Component, Fragment } from 'preact';
import Modal from 'react-modal';
import processString from 'react-process-string';
import Logo from '../../components/logo';
import Timer from '../../components/player/timer';
import WaveformProgress from '../../components/waveform';
import { slugify } from '../../utilities';

Modal.setAppElement('#app');

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

export default class Player extends Component {
  state = {
    currentTime: 0
  };

  componentDidMount() {
    this.updateTimer();
  }

  updateTimer = () => {
    const { audio } = this.props;
    audio.addEventListener('timeupdate', () => {
      this.setState({
        currentTime: audio.currentTime
      });
    });
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
      modalTrack: null
    });
  }

  render({ audio, currentTrack }, { currentTime }) {
    const currentTrackClass = currentTrack ? slugify(currentTrack.title) : '';
    const modalDescription = processString(processStringConfig)(currentTrack.content);
    return (
      <Fragment>
        <div className={'player ' + currentTrackClass}>
          <div className="player-artwork">
            <Logo className="player-artwork-icon"/>
          </div>
          <div className="player-track-details">
            <h2 className="player-track-title">{currentTrack ? currentTrack.title : ''}</h2>
            <Timer
              duration={currentTrack ? currentTrack.itunes.duration : '0'}
              currentTime={currentTime}
            />
            <button
              className="player-track-info-button"
              onClick={() => this.openModal(currentTrack)}
              aria-label="Track Info">i</button>
          </div>
          <div className="player-controls">
          </div>
          <div className="player-progress">
            <WaveformProgress
              audio={audio}
              currentTrack={currentTrack}
              isWaveformReady={this.isWaveformReady}
            />
          </div>
          <div className="player-volume">
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
            <h1 className="modal-title">{ currentTrack.title }</h1>
            <pre className="modal-description">{ modalDescription }</pre>
            <p className="modal-url">
              <a href={ currentTrack.link }>
                View track on Soundcloud
              </a>
            </p>
            <button
              onClick={this.closeModal}
              className="modal-close"
              aria-label="Close Modal">
              x
            </button>
          </div>
        </Modal>
      </Fragment>
    );
  }
}