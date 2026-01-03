import styles from './style.module.scss';

const Loader = (props) => (
  <div className={`${styles.loader} ${props.inline ? styles['loader--inline'] : ''}`}>
    <div className={styles.rect1}></div>
    <div className={styles.rect2}></div>
    <div className={styles.rect3}></div>
    <div className={styles.rect4}></div>
    <div className={styles.rect5}></div>
    <span>Loading...</span>
  </div>
);

export default Loader;