import { useEffect, useRef } from 'preact/hooks';
import { usePlayer } from '../../contexts/player-context';
import Loader from '../loader';
import styles from './style.module.scss';

const WaveformProgress = () => {
  const { state, attachWaveform } = usePlayer();
  const waveformRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (waveformRef.current) {
      attachWaveform(waveformRef.current);
    }
  }, [attachWaveform]);

  return (
    <>
      <div
        ref={waveformRef}
        class={`${styles['waveform-wrapper']} ${state.isReady ? styles['waveform-wrapper--loaded'] : ''}`}
      />
      {!state.isReady &&
        <div class={styles['player-progress-loader']}>
          <Loader inline />
        </div>
      }
    </>
  );
};

export default WaveformProgress;
