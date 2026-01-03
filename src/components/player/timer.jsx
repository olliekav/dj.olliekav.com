import { useContext, useEffect, useState } from "preact/hooks";
import { PlayerContext } from '../../contexts/player-context';
import styles from './style.module.scss';
import { prettyTime } from '../../utilities';

const Timer = (props) => {
  const { player, wavesurfer } = useContext(PlayerContext);
  const [ currentTime, setCurrentTime ] = useState(0);

  useEffect(() => {
    const currentTime = () => {
      setCurrentTime(wavesurfer.getCurrentTime())
    };
    wavesurfer.on('audioprocess', currentTime);
    return () => {
      wavesurfer.un('audioprocess', currentTime);
    };
  }), [wavesurfer, setCurrentTime];

  return (
    <span class={styles['player-track-timer']}>
      {prettyTime(currentTime)} / {prettyTime(player.duration, true)}
    </span>
  )
}

export default Timer;
