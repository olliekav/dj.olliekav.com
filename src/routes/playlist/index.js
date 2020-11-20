import { h, Component, Fragment, useContext } from 'preact';
import { contextType } from 'preact/compat';
import ClassNames from 'classnames';
import processString from 'react-process-string';

import withPlayer from '../../contexts/withPlayer';
import { PlayerContext } from '../../contexts/player-context';
import style from './style';
import Logo from '../../components/logo';
import Loader from '../../components/loader';
import { prettyTime, slugify } from '../../utilities';
import '../../utilities/soundcloud-api';

class Playlist extends Component {

  constructor() {
    super();
    this.state = {
      modalIsOpen: false,
      modalTrack: ''
    };
  }

  playTrackAtIndex = (i, track) => {
    this.props.context.playTrackAtIndex(i, track);
  }

  renderTrackList() {
    const { activeIndex, playlist } = this.props.context;
    const tracks = playlist.map((track, i) => {
      const classNames = ClassNames('playlist-track-button', {
        'active-track': activeIndex === i
      });
      const trackTitle = slugify(track.title);
      return (
        <div 
          key={track.id}
          class={'playlist-track ' + trackTitle}>
          <button
            class={classNames}
            onClick={() => this.playTrackAtIndex(i, track)}>
            <Logo class="playlist-track-icon"/>
            <h2 class="playlist-track-title">#{i+1}</h2>
            <span class="playlist-track-time">{track.itunes.duration}</span>
            <span class="playlist-track-genre">{track.genre}</span>
          </button>
        </div>
      );
    });
    return (
      <div class="playlist">{tracks}</div>
    );
  }

  render() {
    return this.renderTrackList();
  }
}

export default withPlayer(Playlist);
