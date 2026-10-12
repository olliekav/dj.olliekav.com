import { useEffect } from 'preact/hooks';
import Logo from '../../components/logo';
import { usePlayer } from '../../contexts/player-context';
import { mixJsonLd, mixTitle, scriptJson } from '../../utilities/seo';
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
      <h1 class="sr-only">{mix.title}</h1>
      <Logo />
    </article>
  );
};

export default MixPage;
