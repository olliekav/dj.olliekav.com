import { useEffect, useState } from 'preact/hooks';
import { usePlayer } from '../../contexts/player-context';
import { prettyTime } from '../../utilities/format';
import styles from './style.module.scss';

const Timer = () => {
  const { wavesurfer, currentMix } = usePlayer();
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setCurrentTime(wavesurfer?.getCurrentTime() ?? 0);
    return wavesurfer?.on('timeupdate', setCurrentTime);
  }, [wavesurfer, currentMix]);

  return (
    <span class={styles['player-track-timer']}>
      {prettyTime(currentTime)} / {prettyTime((currentMix?.duration_ms ?? 0) / 1000)}
    </span>
  );
};

export default Timer;
