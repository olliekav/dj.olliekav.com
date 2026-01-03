import { useContext } from 'preact/hooks';
import ClassNames from 'classnames';
import { PlayerContext } from '../../contexts/player-context';
import Logo from '../../components/logo';
import { slugify } from '../../utilities';
import styles from './style.module.scss';
import { prettyTime } from '../../utilities';

const Playlist = () => {
  const { player, playTrackAtIndex } = useContext(PlayerContext);
  
  const tracks = player.tracks.map((track, i) => {
    const buttonClassNames = ClassNames(styles['playlist-track-button'], {
      [styles['active-track']]: player.activeIndex === i
    });
    return (
      <li 
        key={track.id}
        class={`${styles['playlist-track']} ${styles[slugify(track.title)]}`}>
        <button
          class={buttonClassNames}
          onClick={() => playTrackAtIndex(i, track)}
        >
          <Logo class={styles['playlist-track-icon']} />
          <h2 class={styles['playlist-track-title']}>#{i+1}</h2>
          <span class={styles['playlist-track-time']}>{prettyTime(track.duration_ms, true)}</span>
          <span class={styles['playlist-track-genre']}>{track.genre}</span>
        </button>
      </li>
    );
  });

  return (
    <ol class={styles['playlist']}>{tracks}</ol>
  );
}

export default Playlist;
