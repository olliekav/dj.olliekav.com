import styles from './style.module.scss';

const Loader = ({ inline = false }: { inline?: boolean }) => (
  <div class={`${styles.loader} ${inline ? styles['loader--inline'] : ''}`}>
    <div class={styles.rect1} />
    <div class={styles.rect2} />
    <div class={styles.rect3} />
    <div class={styles.rect4} />
    <div class={styles.rect5} />
    <span>Loading...</span>
  </div>
);

export default Loader;
