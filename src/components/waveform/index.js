import { h, Component } from 'preact';
import WaveSurfer from 'wavesurfer.js';
import Loader from '../../components/loader';
import withPlayer from '../../contexts/withPlayer';
import { PlayerContext } from '../../contexts/player-context';
import '../../utilities/soundcloud-api';
import style from './style';

class WaveformProgress extends Component {

  static contextType = PlayerContext;
  
  constructor() {
    super();
    this.state = {
      iframeLoaded: false,
      peaks: [],
      waveColor: '#cccccc',
      isLoaded: false
    };
  }

  componentDidMount() {
    this.getWaveForm();
  }

  componentDidUpdate(prevProps, prevState) {
    if(prevProps.context.currentTrack !== this.props.context.currentTrack) {
      this.props.context.wavesurfer.empty();
      this.getWaveForm();
    }
  }

  setWaveProgressColor = () => {
    const currentTrackIndex = this.props.context.activeIndex+1;
    let color = '';
    switch(currentTrackIndex) {
      case 1:
        color = '#2A10A6';
        break;
      case 2:
        color = '#EC1C24';
        break;
      case 3:
        color = '#28C517';
        break;
      case 4:
        color = '#08F9A9';
        break;
      case 5:
        color = '#FFF100';
        break;
      case 6:
        color = '#EC297B';
        break;
      case 7:
        color = '#0F97FF';
        break;
      case 8:
        color = '#FF8300';
        break;
      case 9:
        color = '#007E7F';
        break;
      case 10:
        color = '#48FFE8';
        break;
      case 11:
        color = '#7300AA';
        break;
      case 12:
        color = '#42A942';
        break;
      case 13:
        color = '#FF0004';
        break;
      case 14:
        color = '#F8D1E3';
        break;
      case 15:
        color = '#D81927';
        break;
      case 16:
        color = '#B4BD00';
        break;
      case 17:
        color = '#C1B49A';
        break;
      case 18:
        color = '#00AAAD';
        break;
      case 19:
        color = '#D91C5C';
        break;
      case 20:
        color = '#FD8E8D';
        break;
      case 21:
        color = '#36D1DC';
        break;
      case 22:
        color = '#FF9966';
        break;
      case 23:
        color = '#FF9966';
        break;
      case 24:
        color = '#8CA6DB';
        break;
      case 25:
        color = '#EF629F';
        break;
      case 26:
        color = '#666969';
        break;
      case 27:
        color = '#3B8D99';
        break;
      case 28:
        color = '#BD3F32';
        break;
      case 29:
        color = '#2657eb';
        break;
      case 30:
        color = '#fdbb2d';
        break;
      case 31:
        color = '#ccff00';
        break;
      case 32:
        color = '#15f4ee';
        break;
      case 33:
        color = '#f4158b';
        break;
      case 34:
        color = '#1cf415';
        break;
      case 35:
        color = '#ff6d00';
        break;
      case 36:
        color = '#b400ff';
        break;
      case 37:
        color = '#0066ff';
        break;
      case 38:
        color = '#ec1c24';
        break;
      case 39:
        color = '#fff100';
        break;
      case 40:
        color = '#00ffa4';
        break;
      case 41:
        color = '#3579c2';
        break;
      case 42:
        color = '#de65c2';
        break;
      case 43:
        color = '#de654e';
        break;
      case 44:
        color = '#47853c';
        break;
      case 45:
        color = '#513D83';
        break;
      case 46:
        color = '#9E2946';
        break;
      case 47:
        color = '#48c3bd';
        break;
      case 48:
        color = '#5c5c5c';
        break;
      case 49:
        color = '#E5A913';
        break;
      case 50:
        color = '#D84861';
        break;
      case 51:
        color = '#C0DAAA';
        break;
      case 52:
        color = '#CD4B53';
        break;
      case 53:
        color = '#FFA666';
        break;
      case 54:
        color = '#F46F95';
        break;
      case 55:
        color = '#BAFBC7';
        break;
      case 56:
        color = '#3FD7F7';
        break;
      case 57:
        color = '#F45922';
        break;
      case 58:
        color = '#D34F4F';
        break;
      case 59:
        color = '#636D6A';
        break;
      case 60:
        color = '#2A9368';
        break;
      case 61:
        color = '#1B85DD';
        break;
      case 62:
        color = '#6A3C6D';
        break;
      case 63:
        color = '#167382';
        break;
      default:
        color = '#101010';
    }
    this.props.context.wavesurfer.params.progressColor = color;
    this.props.context.wavesurfer.params.cursorColor = color;
  }

  setColorScheme = () => {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Listen initially on load
    if(darkMode.matches) {
      this.setDarkMode();
    } else {
      this.setLightMode();
    }

    // Listen for system changes
    darkMode.addListener(e => {
      if(e.matches) {
        this.setDarkMode()
      } else {
        this.setLightMode()
      }
    })
  }

  setDarkMode = () => {
    this.props.context.wavesurfer.params.waveColor = '#262626';
    this.props.context.wavesurfer.params.backgroundColor = '#101010';
    this.props.context.wavesurfer.drawBuffer();
  }

  setLightMode = () => {
    this.props.context.wavesurfer.params.waveColor = '#CCCCCC';
    this.props.context.wavesurfer.params.backgroundColor = '#ffffff';
    this.props.context.wavesurfer.drawBuffer();
  }

  getWaveForm = () => {
    const { currentTrack } = this.props.context;
    const iframe = document.querySelector('iframe');
    const trackId = currentTrack.guid.split("/");
    iframe.src = `https://w.soundcloud.com/player/?url=http://api.soundcloud.com/tracks/${trackId[1]}&auto_play=false&buying=false&liking=false&download=false&sharing=false&show_artwork=false&show_comments=false&show_playcount=false&show_user=false&hide_related=false&visual=true&start_track=0&callback=true`;
    iframe.onload = () => {
      this.setState({
        iframeLoaded: true
      }, () => {
        const widget = SC.Widget(iframe);
        widget.getCurrentSound(async info => {
          try {
            const response = await fetch(info.waveform_url);
            if (!response.ok) {
              throw Error(response.statusText);
            }
            const responseData = await response.json();
            this.setState({
              isLoaded: true,
              peaks: responseData.samples
            }, () => {
              this.generateWaveForm();
            });
          } catch(error) {
            console.log('Error fetching and parsing data', error);
          }
        });
      });
    }
  }

  generateWaveForm = () => {
    const { currentTrack } = this.props.context;
    this.props.context.wavesurfer.load(currentTrack.enclosure.url, this.state.peaks);
    this.setColorScheme();
    this.setWaveProgressColor();
    this.props.context.wavesurfer.drawBuffer();
  }

  render(props, state) {
    return (
      <div className="player-progress">
        <div
          ref={props.waveformChildRef}
          className={`waveform-wrapper ${ state.isLoaded ? 'loaded' : ''}`}
        />
        <iframe
          className="soundcloud-iframe"
          id="sc-widget"
          frameborder="no"
          scrolling="no"
        ></iframe>
        { !state.isLoaded &&
          <div class="player-progress-loader">
            <Loader inline="true"/>
          </div>
        }
      </div>
    );
  }
}

export default withPlayer(WaveformProgress);
