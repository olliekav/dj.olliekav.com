import { h } from 'preact';
import { useContext } from "preact/hooks";
import { PlayerContext } from '../../contexts/player-context';

const PrevButton = (props) => {
  const { player } = useContext(PlayerContext);
  const disabled = player.activeIndex === 0 || !player.wavesurferReady;
  return (
    <button class="player-button" {...props} disabled={disabled}>
      <svg viewBox="0 0 53 30" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <path d="M23.2970385,29.6822423 C24.7618846,29.6822423 26.0013462,28.5554388 26.0013462,26.4708538 L26.0013462,15.6535385 C26.2079231,16.4423077 26.7901154,17.1183846 27.8042308,17.7193462 L46.9411538,28.9873808 C47.6923077,29.4381 48.3307692,29.6822423 49.1007692,29.6822423 C50.5657692,29.6822423 51.805,28.5554388 51.805,26.4708538 L51.805,3.39019231 C51.805,1.30557692 50.5657692,0.178769231 49.1007692,0.178769231 C48.3307692,0.178769231 47.7111538,0.422923077 46.9411538,0.873653846 L27.8042308,12.1416923 C26.7713462,12.7426538 26.2079231,13.4187308 26.0013462,14.2075 L26.0013462,3.39019231 C26.0013462,1.30557692 24.7618846,0.178769231 23.2970385,0.178769231 C22.5270385,0.178769231 21.9073077,0.422923077 21.1373077,0.873653846 L2.00045,12.1416923 C0.667069231,12.9304231 0.103665385,13.8506538 0.103665385,14.9211154 C0.103665385,16.0103846 0.667069231,16.9305769 2.00045,17.7193462 L21.1373077,28.9873808 C21.8885385,29.4381 22.5270385,29.6822423 23.2970385,29.6822423 Z"></path>
      </svg>
      <span class="sr-only">Prev Track</span>
    </button>
  )
};

export default PrevButton;
