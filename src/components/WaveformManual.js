import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { scaleLinear } from 'd3-scale';
import { mean } from 'd3-array';
import _ from 'lodash';

class Waveform extends Component {
  constructor(props) {
    super(props);
  
    this.state = {
      waveform: ''
    };
  }

  componentDidMount() {
    this.getWaveFormJSON();
  }

  getWaveFormJSON = async (props) => {
    try {
      const response = await fetch(this.props.waveform.replace('png', 'json'));
      if (!response.ok) {
        throw Error(response.statusText);
      }
      const responseData = await response.json();
      this.setState({
        waveform: responseData
      });
    } catch(error) {
      console.log('Error fetching and parsing data', error);
    }
  }

  render() {
    const scaleLinearHeight = scaleLinear().domain([0, this.state.waveform.height]).range([0, 50]);
    // const chunks = _.chunk(props.waveform.samples, props.waveform.width/((props.width - 60)/3));
    const chunks = _.toArray(this.state.waveform.samples);
    console.log(chunks.length);
    const chunkWidth = chunks.length / 100;
    console.log('Chunks: ', chunks);

    return (
      <div style={{display: 'flex', flexDirection: 'row nowrap', height: '100%', width: '100%'}} className="waveform-wrapper">
        {chunks.map((chunk, i) => (
          <button
            key={i}
            onPress={() => {
              // props.setTime(i);
            }}
            style={{
              backgroundColor: 'transparent',
              border: 0,
              flex: '1 1 1px',
              padding: 0
            }}
          >
            <div style={{
              backgroundColor: 'red',
              display: 'flex',
              height: scaleLinearHeight(chunk),
              width: chunkWidth
            }}
            />
          </button>
        ))}
      </div>
    );
  }
}

export default Waveform;