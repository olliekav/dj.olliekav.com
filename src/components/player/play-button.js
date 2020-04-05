import { h } from 'preact';
import { useContext } from "preact/hooks";
import { PlayerContext } from '../../contexts/player-context';

const PlayButton = (props) => {
  const { isPlaying, wavesurferReady } = useContext(PlayerContext);
  return (
    <button class="player-button play-button" {...props} disabled={!wavesurferReady}>
      { isPlaying ?
        <svg viewBox="0 0 31 40" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.47265,39.77051 L9.03905,39.77051 C11.1631,39.77051 12.28615,38.64746 12.28615,36.499025 L12.28615,3.24705 C12.28615,1.0254 11.1631,0 9.03905,0 L3.47265,0 C1.34865,0 0.2256,1.12305 0.2256,3.24705 L0.2256,36.499025 C0.2256,38.64746 1.34865,39.77051 3.47265,39.77051 Z M21.2217,39.77051 L26.76365,39.77051 C28.9121,39.77051 30.01075,38.64746 30.01075,36.499025 L30.01075,3.24705 C30.01075,1.0254 28.9121,0 26.76365,0 L21.2217,0 C19.07325,0 17.9502,1.12305 17.9502,3.24705 L17.9502,36.499025 C17.9502,38.64746 19.07325,39.77051 21.2217,39.77051 Z"></path>
        </svg>
        :
        <svg viewBox="0 0 36 40" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path d="M3.005,39.5963524 C3.93509524,39.5963524 4.72561905,39.2243286 5.65571429,38.6895476 L32.7669048,23.0180476 C34.6968095,21.8787143 35.3710952,21.1346667 35.3710952,19.9023333 C35.3710952,18.67 34.6968095,17.9259524 32.7669048,16.8099048 L5.65571429,1.11514286 C4.72561905,0.580380952 3.93509524,0.231571429 3.005,0.231571429 C1.28442857,0.231571429 0.214857143,1.53366667 0.214857143,3.55657143 L0.214857143,36.24814 C0.214857143,38.271019 1.28442857,39.5963524 3.005,39.5963524 Z"></path>
        </svg>
      }
      
    </button>
  )
};

export default PlayButton;