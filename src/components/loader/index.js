import { h } from 'preact';
import style from './style';

const Loader = (props) => (
  <div className={`loader ${props.inline ? 'loader--inline' : ''}`}>
    <div className="rect1"></div>
    <div className="rect2"></div>
    <div className="rect3"></div>
    <div className="rect4"></div>
    <div className="rect5"></div>
    <span>Loading...</span>
  </div>
);

export default Loader;