import { h, Component } from 'preact';
import ClassNames from 'classnames';
import { prettyTime } from '../../utilities';

class Timer extends Component {
  render({ currentTime, duration }, {}) {
    return (
      <div>
        {prettyTime(currentTime)} / {duration}
      </div>
    );
  }
}

export default Timer;