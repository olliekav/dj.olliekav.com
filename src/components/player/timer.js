import { h, Fragment } from 'preact';
import { prettyTime } from '../../utilities';
import { useContext } from "preact/hooks";
import { PlayerContext } from '../../contexts/player-context';

const Timer = (props) => {
  const { player } = useContext(PlayerContext);
  return (
    <span class="player-track-timer">
      {prettyTime(player.currentTime)} / {prettyTime(player.duration)}
    </span>
  )
}

export default Timer;
