import { h, Fragment } from 'preact';
import { prettyTime } from '../../utilities';
import { useContext } from "preact/hooks";
import { PlayerContext } from '../../contexts/player-context';

const Timer = (props) => {
  const { player } = useContext(PlayerContext);
  return (
    <Fragment>
      {prettyTime(player.currentTime)} / {prettyTime(player.duration)}
    </Fragment>
  )
}

export default Timer;
