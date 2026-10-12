import { useLayoutEffect } from 'preact/hooks';
import Logo from '../../components/logo';
import { usePlayer } from '../../contexts/player-context';
import { prettyTime } from '../../utilities/format';
import { DESCRIPTION, HOME_TITLE, mixPath, playlistJsonLd, scriptJson, SITE_NAME } from '../../utilities/seo';
import { themeStyle } from '../../utilities/theme';
import styles from './style.module.css';

let savedScroll = 0;

const Playlist = () => {
	const { state, currentMix, playAt } = usePlayer();

	useLayoutEffect(() => {
		document.title = HOME_TITLE;
		const content = document.querySelector('.content');
		if (!content) {
			return;
		}
		content.scrollTop = savedScroll;
		const save = () => {
			savedScroll = content.scrollTop;
		};
		content.addEventListener('scroll', save, { passive: true });
		return () => content.removeEventListener('scroll', save);
	}, []);

	return (
		<>
			<header class="sr-only">
				<h1>{SITE_NAME}</h1>
				<p>{DESCRIPTION}</p>
			</header>
			{/* A JSON data block, escaped by scriptJson; never parsed as HTML */}
			{/* eslint-disable-next-line react/no-danger */}
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(playlistJsonLd(state.mixes)) }} />
			<ol class={styles['playlist']}>
				{state.mixes.map((mix, i) => (
					<li
						key={mix.id}
						class={`${styles['playlist-track']} ${styles['themed']}`}
						style={themeStyle(mix.theme)}>
						<a
							href={mixPath(mix)}
							class={`${styles['playlist-track-button']} ${currentMix?.id === mix.id ? styles['active-track'] : ''}`}
							onClick={event => {
								if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
									playAt(i);
								}
							}}
							aria-current={currentMix?.id === mix.id ? 'true' : undefined}
						>
							<Logo />
							<h2 class={styles['playlist-track-title']}>
								<span class="sr-only">{SITE_NAME} </span>#{mix.number}
							</h2>
							<span class={styles['playlist-track-time']}>{prettyTime(mix.duration_ms / 1000)}</span>
							{mix.genre && <span class={styles['playlist-track-genre']}>{mix.genre}</span>}
						</a>
					</li>
				))}
			</ol>
		</>
	);
};

export default Playlist;
