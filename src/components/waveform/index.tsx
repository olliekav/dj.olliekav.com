import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { usePlayer } from '../../contexts/player-context';
import { barsLayout } from '../../utilities/waveform';
import Loader from '../loader';
import styles from './style.module.css';

const WaveformProgress = () => {
  const { state, attachWaveform } = usePlayer();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const waveform = waveformRef.current;
    if (!wrapper || !waveform) {
      return;
    }
    const fit = () => {
      const { width, offset } = barsLayout(wrapper.clientWidth);
      waveform.style.width = `${width}px`;
      waveform.style.marginLeft = `${offset}px`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (waveformRef.current) {
      attachWaveform(waveformRef.current);
    }
  }, [attachWaveform]);

  return (
    <>
      <div
        ref={wrapperRef}
        class={`${styles['waveform-wrapper']} ${state.isReady ? styles['waveform-wrapper--loaded'] : ''}`}
      >
        <div ref={waveformRef} class={styles['waveform']} />
      </div>
      {!state.isReady &&
        <div class={styles['player-progress-loader']}>
          <Loader inline />
        </div>
      }
    </>
  );
};

export default WaveformProgress;
