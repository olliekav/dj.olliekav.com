import { h, Component } from 'preact';
import { PlayerContext } from '../contexts/player-context';

export default function withPlayer(Component) {
  return function contextComponent(props) {
    return (
      <PlayerContext.Consumer>
        {context => <Component {...props} context={context} />}
      </PlayerContext.Consumer>
    )
  }
}