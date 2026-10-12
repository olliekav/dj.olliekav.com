import { useEffect } from 'preact/hooks';
import Logo from '../../components/logo';
import { usePlayer } from '../../contexts/player-context';
import { mixJsonLd, mixTitle, scriptJson, SITE_NAME } from '../../utilities/seo';
import { themeStyle } from '../../utilities/theme';
import { NotFound } from '../_404';
import playlistStyles from '../Playlist/style.module.css';
import styles from './style.module.css';

const MixPage = ({ slug }: { slug: string }) => {
  const { state, cue } = usePlayer();
  const index = state.mixes.findIndex(mix => mix.slug === slug);
  const mix = state.mixes[index];

  useEffect(() => {
    if (index !== -1) {
      cue(index);
    }
  }, [index, cue]);

  useEffect(() => {
    if (mix) {
      document.title = mixTitle(mix);
    }
  }, [mix]);

  if (!mix) {
    return <NotFound />;
  }

  return (
    <article class={`${styles['mix']} ${playlistStyles['themed']}`} style={themeStyle(mix.theme)}>
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(mixJsonLd(mix)) }} />
      <a class={styles['mix-back']} href="/">
        <span aria-hidden="true">←</span> All mixes
      </a>
      <div class={styles['mix-logo']}>
        <Logo />
        <h1 class={styles['mix-number']}>
          <span class="sr-only">{SITE_NAME} </span>#{mix.number}
        </h1>
      </div>
    </article>
  );
};

export default MixPage;
