import { h, Component, createRef } from 'preact';
import { useState, useContext, useEffect, useReducer, useRef } from 'preact/hooks';
import WaveSurfer from 'wavesurfer.js';
import Loader from '../../components/loader';
import withPlayer from '../../contexts/withPlayer';
import { PlayerContext } from '../../contexts/player-context';
import '../../utilities/soundcloud-api';
import style from './style';

const WaveformProgress = props => {
  const iframe = createRef();
  const { player, wavesurfer, setTimers, initWavesurfer } = useContext(PlayerContext);
  const [state, setState] = useReducer(
    (state, newState) => ({...state, ...newState}),
    {
      iframeLoaded: false,
      peaks: [],
      waveColor: '#cccccc',
      isLoaded: false
    }
  );

  const waveformRef = useRef();
  useEffect(() => {
    if(waveformRef.current) {
      initWavesurfer(waveformRef.current);
    }
  }, []);

  useEffect(() => {
    getWaveForm();
  }, [player.currentTrack]);

  const setWaveProgressColor = () => {
    const currentTrackIndex = player.activeIndex+1;
    let color = '';
    switch(currentTrackIndex) {
      case 1:
        color = '#EC00A5';
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
      case 64:
        color = '#9DCF83';
        break;
      case 65:
        color = '#ccbe7a';
        break;
      case 66:
        color = '#d27fa2';
        break;
      case 67:
        color = '#514c6f';
        break;
      case 68:
        color = '#ab597d';
        break;
      case 69:
        color = '#cc5499';
        break;
      case 70:
        color = '#534231';
        break;
      case 71:
        color = '#e26b4b';
        break;
      case 72:
        color = '#bf4040';
        break;
      case 73:
        color = '#e2a050';
        break;
      case 74:
        color = '#645d72';
        break;
      case 75:
        color = '#c191b7';
        break;
      case 76:
        color = '#25b1b2';
        break;
      case 77:
        color = '#e23969';
        break;
      case 78:
        color = '#f6921e';
        break;
      case 79:
        color = '#66ffaf';
        break;
      case 80:
        color = '#3c456b';
        break;
      case 81:
        color = '#bcb57a';
        break;
      case 82:
        color = '#ffd700';
        break;
      case 83:
        color = '#bcef65';
        break;
      case 84:
        color = '#913944';
        break;
      case 85:
        color = '#ffb7e5';
        break;
      case 86:
        color = '#dcffb6';
        break;
      case 87:
        color = '#1ed0f9';
        break;
      default:
        color = '#101010';
    }
    wavesurfer.params.progressColor = color;
    wavesurfer.params.cursorColor = color;
  }

  const setColorScheme = () => {
    const darkMode = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Listen initially on load
    if(darkMode.matches) {
      setDarkMode();
    } else {
      setLightMode();
    }

    // Listen for system changes
    darkMode.addListener(e => {
      if(e.matches) {
        setDarkMode()
      } else {
        setLightMode()
      }
    })
  }

  const setDarkMode = () => {
    wavesurfer.params.waveColor = '#262626';
    wavesurfer.params.backgroundColor = '#101010';
    wavesurfer.drawBuffer();
  }

  const setLightMode = () => {
    wavesurfer.params.waveColor = '#CCCCCC';
    wavesurfer.params.backgroundColor = '#ffffff';
    wavesurfer.drawBuffer();
  }

  const getWaveForm = () => {
    setState({
      isLoaded: false
    });
    const trackId = player.currentTrack.guid.split('/');
    const url = `https://api.soundcloud.com/tracks/${trackId[1]}`;
    const widget = SC.Widget('sc-widget');
    const options = {
      show_artwork: false,
      auto_play: false,
      buying: false,
      liking: false,
      download: false,
      sharing: false,
      show_comments: false,
      show_playcount: false,
      show_user: false,
      hide_related: false, 
      visual: true,
      start_track: 0
    };
    widget.load(url, options, () => {
      console.log('loaded');
    });
    widget.bind(SC.Widget.Events.READY, () => {
      widget.getCurrentSound(async info => {
        try {
          const response = await fetch(info.waveform_url);
          if (!response.ok) {
            throw Error(response.statusText);
          }
          const responseData = await response.json();
          setState({
            isLoaded: true,
            peaks: responseData.samples
          });
        } catch(error) {
          console.log('Error fetching and parsing data', error);
        }
      });
    });
  }

  useEffect(() => {
    generateWaveForm();
  }, [state.peaks]);

  const generateWaveForm = () => {
    if(wavesurfer) {
      wavesurfer.load(player.currentTrack.enclosure.url, state.peaks);
      setColorScheme();
      setWaveProgressColor();
      wavesurfer.drawBuffer();
      wavesurfer.on('ready', () => {
        setTimers();
      });
    }
  }

  return (
    <div className="player-progress">
      <div
        ref={waveformRef}
        class={`waveform-wrapper ${ state.isLoaded ? 'loaded' : ''}`}
      />
      <iframe
        ref={iframe}
        id="sc-widget"
        className="soundcloud-iframe"
        src="https://w.soundcloud.com/player/?url=https://api.soundcloud.com/tracks/338578337&auto_play=false&buying=false&liking=false&download=false&sharing=false&show_artwork=false&show_comments=false&show_playcount=false&show_user=false&hide_related=false&visual=true&start_track=0&callback=true"
        frameborder="no"
        scrolling="no"
        allow="autoplay"
      ></iframe>
      { !state.isLoaded &&
        <div class="player-progress-loader">
          <Loader inline="true"/>
        </div>
      }
    </div>
  );

}

export default WaveformProgress;
