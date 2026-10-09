import { useEffect, useRef } from 'preact/hooks';
import { usePlayer } from '../../contexts/player-context';
import { reportDownload } from '../../utilities/api';
import { linkify } from '../../utilities/format';
import styles from './style.module.scss';

interface PlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PlayerModal = ({ isOpen, onClose }: PlayerModalProps) => {
  const { currentMix } = usePlayer();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (isOpen && !dialog?.open) {
      dialog?.showModal();
    } else if (!isOpen && dialog?.open) {
      dialog.close();
    }
  }, [isOpen]);

  if (!currentMix) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      class={styles['modal']}
      onClose={onClose}
      // Clicks on the backdrop land on the dialog element itself
      onClick={event => event.target === event.currentTarget && onClose()}
      aria-labelledby="mix-info-title"
    >
      <div class={styles['modal-content']}>
        <h1 id="mix-info-title" class={styles['modal-title']}>{currentMix.title}</h1>
        <div class={styles['modal-description']}>
          {linkify(currentMix.description).map((part, i) =>
            typeof part === 'string' ? part : (
              <a key={i} href={part.href} target="_blank" rel="noopener noreferrer">{part.text}</a>
            )
          )}
        </div>
        {currentMix.audio.mp3 &&
          <p class={styles['modal-url']}>
            <a href={currentMix.audio.mp3} download onClick={() => reportDownload(currentMix.slug)}>
              Download MP3
            </a>
          </p>
        }
        {currentMix.soundcloud_url &&
          <p class={styles['modal-url']}>
            <a href={currentMix.soundcloud_url} target="_blank" rel="noopener noreferrer">
              Also on SoundCloud
            </a>
          </p>
        }
        <button
          onClick={onClose}
          class={styles['modal-close']}
          aria-label="Close Modal">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M3.61289944,2.20970461 L3.70710678,2.29289322 L12,10.585 L20.2928932,2.29289322 C20.6834175,1.90236893 21.3165825,1.90236893 21.7071068,2.29289322 C22.0675907,2.65337718 22.0953203,3.22060824 21.7902954,3.61289944 L21.7071068,3.70710678 L13.415,12 L21.7071068,20.2928932 C22.0976311,20.6834175 22.0976311,21.3165825 21.7071068,21.7071068 C21.3466228,22.0675907 20.7793918,22.0953203 20.3871006,21.7902954 L20.2928932,21.7071068 L12,13.415 L3.70710678,21.7071068 C3.31658249,22.0976311 2.68341751,22.0976311 2.29289322,21.7071068 C1.93240926,21.3466228 1.90467972,20.7793918 2.20970461,20.3871006 L2.29289322,20.2928932 L10.585,12 L2.29289322,3.70710678 C1.90236893,3.31658249 1.90236893,2.68341751 2.29289322,2.29289322 C2.65337718,1.93240926 3.22060824,1.90467972 3.61289944,2.20970461 Z" /></svg>
        </button>
      </div>
    </dialog>
  );
};

export default PlayerModal;
