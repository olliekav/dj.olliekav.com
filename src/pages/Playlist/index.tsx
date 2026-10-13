import { useLocation } from 'preact-iso';
import { useLayoutEffect } from 'preact/hooks';
import Logo from '../../components/logo';
import { usePlayer } from '../../contexts/player-context';
import { prettyTime } from '../../utilities/format';
import { DESCRIPTION, HOME_TITLE, mixPath, playlistJsonLd, scriptJson, SITE_NAME } from '../../utilities/seo';
import { themeStyle } from '../../utilities/theme';
import { isPlainClick, mixTransitionNames, routeWithTransition } from '../../utilities/view-transition';
import styles from './style.module.css';

let savedScroll = 0;

const Playlist = () => {
	const { state, currentMix, playAt } = usePlayer();
	const { route } = useLocation();

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
				{state.mixes.map((mix, i) => {
					// Only the current mix's tile animates to and from its page: naming every tile makes
					// the browser snapshot all of them on each transition
					const names = currentMix?.id === mix.id ? mixTransitionNames(mix.number) : undefined;
					return (
					<li
						key={mix.id}
						class={`${styles['playlist-track']} ${styles['themed']}`}
						style={{ ...themeStyle(mix.theme), viewTransitionName: names?.card }}>
						<a
							href={mixPath(mix)}
							class={`${styles['playlist-track-button']} ${currentMix?.id === mix.id ? styles['active-track'] : ''}`}
							onClick={event => {
								if (!isPlainClick(event)) {
									return;
								}
								// Route here, inside the transition, rather than in the router's own click handler
								event.preventDefault();
								event.stopPropagation();
								playAt(i);
								routeWithTransition(route, mixPath(mix));
							}}
							aria-current={currentMix?.id === mix.id ? 'true' : undefined}
						>
							<Logo transitionName={names?.logo} />
							<h2 class={styles['playlist-track-title']} style={{ viewTransitionName: names?.number }}>
								<span class="sr-only">{SITE_NAME} </span>#{mix.number}
							</h2>
							<span class={styles['playlist-track-time']}>{prettyTime(mix.duration_ms / 1000)}</span>
							{mix.genre && <span class={styles['playlist-track-genre']}>{mix.genre}</span>}
						</a>
					</li>
					);
				})}
			</ol>
		</>
	);
};

export default Playlist;
