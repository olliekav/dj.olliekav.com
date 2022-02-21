import { h, Component, Fragment } from 'preact';
import { useContext } from 'preact/hooks';
import { contextType } from 'preact/compat';
import ClassNames from 'classnames';
import processString from 'react-process-string';
import withPlayer from '../../contexts/withPlayer';
import { PlayerContext } from '../../contexts/player-context';
import style from './style';
import Logo from '../../components/logo';
import Loader from '../../components/loader';
import { prettyTime, slugify } from '../../utilities';

const Playlist = props => {
  const { player, playTrackAtIndex } = useContext(PlayerContext);
  const tracks = player.playlist.map((track, i) => {
    const classNames = ClassNames('playlist-track-button', {
      'active-track': player.activeIndex === i
    });
    const trackTitle = slugify(track.title);
    return (
      <li 
        key={track.id}
        class={'playlist-track ' + trackTitle}>
        <button
          class={classNames}
          onClick={() => playTrackAtIndex(i, track)}>
          <Logo class="playlist-track-icon"/>
          <h2 class="playlist-track-title">#{i+1}</h2>
          <span class="playlist-track-time">{track.itunes.duration}</span>
          <span class="playlist-track-genre">{track.genre}</span>
        </button>
      </li>
    );
  });

  return (
    <ol class="playlist">{tracks}</ol>
  );
}

export default Playlist;
