import { useEffect, useLayoutEffect } from 'preact/hooks';
import Description from '../../components/description';
import Logo from '../../components/logo';
import { usePlayer } from '../../contexts/player-context';
import { prettyDate, prettyTime } from '../../utilities/format';
import { mixJsonLd, mixTitle, scriptJson } from '../../utilities/seo';
import { themeStyle } from '../../utilities/theme';
import { NotFound } from '../_404';
import playlistStyles from '../Playlist/style.module.css';
import styles from './style.module.css';

const MixPage = ({ slug }: { slug: string }) => {
  const { state, currentMix, playAt, cue, togglePlay } = usePlayer();
  const index = state.mixes.findIndex(mix => mix.slug === slug);
  const mix = state.mixes[index];

  useEffect(() => {
    if (index !== -1) {
      cue(index);
    }
  }, [index, cue]);

  useLayoutEffect(() => {
    document.querySelector('.content')?.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    if (mix) {
      document.title = mixTitle(mix);
    }
  }, [mix]);

  if (!mix) {
    return <NotFound />;
  }

  const isCurrent = currentMix?.id === mix.id;
  const isPlaying = isCurrent && state.isPlaying;
  const isBuffering = isCurrent && state.autoplay && !state.isReady;

  return (
    <article class={`${styles['mix']} ${playlistStyles['themed']}`} style={themeStyle(mix.theme)}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(mixJsonLd(mix)) }} />
      <header class={styles['mix-header']}>
        <a class={styles['mix-back']} href="/">
          <span aria-hidden="true">←</span> All mixes
        </a>
        <div class={styles['mix-artwork']}>
          {mix.artwork_url ? (
            <img src={mix.artwork_url} width={500} height={500} alt={`${mix.title} artwork`} />
          ) : (
            <Logo />
          )}
        </div>
        <div class={styles['mix-details']}>
          <h1 class={styles['mix-title']}>{mix.title}</h1>
          <dl class={styles['mix-facts']}>
            <dt class="sr-only">Session</dt>
            <dd>#{mix.number}</dd>
            {mix.genre && (
              <>
                <dt class="sr-only">Genre</dt>
                <dd>{mix.genre}</dd>
              </>
            )}
            {mix.published_at && (
              <>
                <dt class="sr-only">Released</dt>
                <dd><time dateTime={mix.published_at.slice(0, 10)}>{prettyDate(mix.published_at)}</time></dd>
              </>
            )}
            <dt class="sr-only">Length</dt>
            <dd>{prettyTime(mix.duration_ms / 1000)}</dd>
          </dl>
          <p class={styles['mix-actions']}>
            <button
              class={styles['mix-play']}
              onClick={() => (isPlaying ? togglePlay() : playAt(index))}
            >
              {isBuffering ? 'Buffering…' : isPlaying ? 'Pause' : 'Play mix'}
            </button>
            <a href={mix.permalink_url} target="_blank" rel="noopener noreferrer">
              Listen on SoundCloud
            </a>
          </p>
        </div>
      </header>
      {mix.description.trim() && (
        <section class={styles['mix-description']} aria-labelledby="mix-tracklist">
          <h2 id="mix-tracklist" class={styles['mix-subtitle']}>Tracklist</h2>
          <Description text={mix.description.trim()} />
        </section>
      )}
    </article>
  );
};

export default MixPage;
