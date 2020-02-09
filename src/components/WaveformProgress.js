import React, { Component } from 'react';
import WaveSurfer from 'wavesurfer.js';
import _ from 'lodash';
import '../styles/waveform.scss';

class WaveformProgress extends Component {
  constructor(props) {
    super(props);
  
    this.state = {
      peaks: [],
      waveColor: '#cccccc'
    };
  }

  componentDidMount() {
    this.initWaveSurfer();
    this.getWaveFormJSON();
    this.setColorScheme();
  }

  componentDidUpdate(prevProps) {
    if (this.props.currentTrack !== prevProps.currentTrack) {
      this.getWaveFormJSON();
      this.wavesurfer.empty();
    }
  }

  setWaveProgressColor = () => {
    const currentTrackIndex = this.props.soundCloudAudio._playlistIndex+1;
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
        color = '#1cf415';
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
      default:
        color = '#ff6d00';
    }
    this.wavesurfer.params.progressColor = color;
    this.wavesurfer.params.cursorColor = color;
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
    this.wavesurfer.params.waveColor = '#262626';
    this.wavesurfer.params.backgroundColor = '#101010';
    this.wavesurfer.drawBuffer();
  }

  setLightMode = () => {
    this.wavesurfer.params.waveColor = '#CCCCCC';
    this.wavesurfer.params.backgroundColor = '#ffffff';
    this.wavesurfer.drawBuffer();
  }

  initWaveSurfer = () => {
    this.wavesurfer = WaveSurfer.create({
      backend: 'MediaElement',
      barWidth: 2,
      cursorWidth: 0,
      closeAudioContext: true,
      container: this.waveRef,
      height: 60,
      normalize: true,
      progressColor: 'red',
      responsive: true
    });
  }

  getWaveFormJSON = async () => {
    this.props.isWaveformReady(false);
    try {
      const response = await fetch(this.props.currentTrack.waveform_url.replace('png', 'json'));
      if (!response.ok) {
        throw Error(response.statusText);
      }
      const responseData = await response.json();
      this.setState({
        peaks: responseData.samples
      }, () => {
        this.generateWaveForm();
      });
    } catch(error) {
      console.log('Error fetching and parsing data', error);
    }
  }

  generateWaveForm = () => {
    const peaks = _.toArray(this.state.peaks);
    const audioElement = this.props.soundCloudAudio.audio;
    this.wavesurfer.load(audioElement, peaks);
    this.setWaveProgressColor();
    this.wavesurfer.drawBuffer();
  }

  render() {
    return (
      <div
        className="waveform-wrapper"
        ref={waveRef => this.waveRef = waveRef}
      />
    );
  }
}

export default WaveformProgress;
