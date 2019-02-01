import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import WaveSurfer from 'wavesurfer.js';
import SoundCloudAudio from 'soundcloud-audio';
import ClassNames from 'classnames';
import _ from 'lodash';
import '../styles/waveform.scss';

class WaveformProgress extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.getWaveFormJSON();
  }

  getWaveFormJSON = async (props) => {
    const { soundCloudAudio } = this.props;
    try {
      const response = await fetch(this.props.currentTrack.waveform_url.replace('png', 'json'));
      if (!response.ok) {
        throw Error(response.statusText);
      }
      const responseData = await response.json();
      const peaks = _.toArray(responseData.samples);
      const generatedWaveForm = WaveSurfer.create({
        backend: 'MediaElement',
        barWidth: 2,
        container: this.waveRef,
        height: 60,
        normalize: true,
        progressColor: 'red',
        responsive: true,
        waveColor: '#ccc'
      });
      // generatedWaveForm.backend.peaks = _.toArray(responseData.samples);
      // generatedWaveForm.drawBuffer();
      // generatedWaveForm.on('seek', (progress) => {
      //   this.handleSeekTrack(progress);
      // });
      generatedWaveForm.load(soundCloudAudio.audio, peaks);
      generatedWaveForm.drawBuffer();
    } catch(error) {
      console.log('Error fetching and parsing data', error);
    }
  }

  handleSeekTrack = (progress) => {
    const { onSeekTrack, soundCloudAudio } = this.props;
    // const xPos = (e.pageX - e.currentTarget.getBoundingClientRect().left) / e.currentTarget.offsetWidth;

    if (soundCloudAudio && !isNaN(soundCloudAudio.audio.duration)) {
      soundCloudAudio.audio.currentTime = (progress * soundCloudAudio.audio.duration);
    }

    onSeekTrack && onSeekTrack.call(this, progress, progress);
  }

  render() {
    const { className, innerClassName, style, currentTime, duration } = this.props;
    let { value, innerStyle } = this.props;

    if (!value && currentTime && duration) {
      value = (currentTime / duration) * 100 || 0;
    }

    if (value < 0) {
      value = 0;
    }

    if (value > 100) {
      value = 100;
    }

    const classNames = ClassNames('sb-soundplayer-progress-container', className);
    const innerClassNames = ClassNames('sb-soundplayer-progress-inner', innerClassName);

    if (!innerStyle) {
      innerStyle = {};
    }

    innerStyle = Object.assign({}, innerStyle, {width: `${value}%`});

    return (
      <div className={classNames} style={style}>
        <div className={innerClassNames} style={innerStyle} />
        <div ref={waveRef => this.waveRef = waveRef} className="waveform-wrapper"></div>
      </div>
    );
  }
}

WaveformProgress.propTypes = {
  className: PropTypes.string,
  innerClassName: PropTypes.string,
  innerStyle: PropTypes.object,
  value: PropTypes.number,
  onSeekTrack: PropTypes.func,
  soundCloudAudio: PropTypes.instanceOf(SoundCloudAudio)
};

WaveformProgress.defaultProps = {
  value: 0
};

export default WaveformProgress;