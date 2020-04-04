import { h, Fragment } from 'preact';
import { prettyTime } from '../../utilities';
import { useContext } from "preact/hooks";
import { PlayerContext } from '../../contexts/player-context';

const Timer = (props) => {
  const { currentTime, duration } = useContext(PlayerContext);
  return (
    <Fragment>
      {prettyTime(currentTime)} / {prettyTime(duration)}
    </Fragment>
  )
}

export default Timer;