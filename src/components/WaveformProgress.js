import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import WaveSurfer from 'wavesurfer.js';
import _ from 'lodash';
import '../styles/waveform.scss';

class Waveform extends Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    this.getWaveFormJSON();
  }

  getWaveFormJSON = async (props) => {
    try {
      const response = await fetch(this.props.currentTrack.waveform_url.replace('png', 'json'));
      if (!response.ok) {
        throw Error(response.statusText);
      }
      const responseData = await response.json();
      const generatedWaveForm = WaveSurfer.create({
        backend: 'MediaElement',
        container: this.waveRef,
        barWidth: 3,
        height: 60,
        normalize: true,
        progressColor: 'white',
        responsive: true,
        waveColor: 'white'
      });
      generatedWaveForm.backend.peaks = _.toArray(responseData.samples);
      generatedWaveForm.drawBuffer();
      generatedWaveForm.on('pause', function () {

      });
    } catch(error) {
      console.log('Error fetching and parsing data', error);
    }
  }

  render() {
    return (
      <div ref={waveRef => this.waveRef = waveRef} className="waveform-wrapper"></div>
    );
  }
}

export default Waveform;