import { h, Fragment } from 'preact';
import { prettyTime } from '../../utilities';
import { useContext, useEffect, useState } from "preact/hooks";
import { PlayerContext } from '../../contexts/player-context';

const Timer = (props) => {
  const { player, wavesurfer } = useContext(PlayerContext);
  const [ currentTime, setCurrentTime ] = useState(0);

  useEffect(() => {
    if (wavesurfer) {
      const currentTime = (e) => {
        setCurrentTime(wavesurfer.getCurrentTime())
      };
      wavesurfer.on('audioprocess', currentTime);
    }
    return () => {
       wavesurfer.un('audioprocess', currentTime);
    };
  }), [wavesurfer, setCurrentTime];

  return (
    <span class="player-track-timer">
      {prettyTime(currentTime)} / {prettyTime(player.duration)}
    </span>
  )
}

export default Timer;
