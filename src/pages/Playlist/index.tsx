import Logo from '../../components/logo';
import { usePlayer } from '../../contexts/player-context';
import { prettyTime } from '../../utilities/format';
import { themeStyle } from '../../utilities/theme';
import styles from './style.module.scss';

const Playlist = () => {
	const { state, currentMix, playAt } = usePlayer();

	return (
		<ol class={styles['playlist']}>
			{state.mixes.map((mix, i) => (
				<li
					key={mix.id}
					class={`${styles['playlist-track']} ${styles['themed']}`}
					style={themeStyle(mix.theme)}>
					<button
						class={`${styles['playlist-track-button']} ${currentMix?.id === mix.id ? styles['active-track'] : ''}`}
						onClick={() => playAt(i)}
						aria-label={`Play ${mix.title}`}
						aria-current={currentMix?.id === mix.id ? 'true' : undefined}
					>
						<Logo />
						<h2 class={styles['playlist-track-title']}>#{mix.number}</h2>
						<span class={styles['playlist-track-time']}>{prettyTime(mix.duration_ms / 1000)}</span>
						{mix.genre && <span class={styles['playlist-track-genre']}>{mix.genre}</span>}
					</button>
				</li>
			))}
		</ol>
	);
};

export default Playlist;
