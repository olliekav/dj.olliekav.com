/**
 * Change route inside a view transition, so elements sharing a view-transition-name (a
 * playlist tile and its mix's page) animate between the two pages. Without support, or
 * with reduced motion, it just changes route.
 */
export const routeWithTransition = (route: (url: string) => void, url: string, update?: () => void) => {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    update?.();
    route(url);
    return;
  }
  // Lets the player bar take its own transition name for now (see style.css); outside a
  // transition the name would stop its background blur
  document.documentElement.classList.add('view-transition');
  const transition = document.startViewTransition(async () => {
    // Other changes (like playing the mix) happen here too, after the old state is captured
    update?.();
    route(url);
    // Preact renders the new route on the next tick; the transition captures it after this
    await new Promise(resolve => setTimeout(resolve));
  });
  transition.finished.finally(() => document.documentElement.classList.remove('view-transition'));
};

/**
 * Route from outside preact-iso's LocationProvider (the player bar): push the URL and tell
 * the router, which follows popstate like it does for back and forward
 */
export const routeFromOutside = (url: string) => {
  history.pushState(null, '', url);
  dispatchEvent(new PopStateEvent('popstate'));
};

/** Whether a click on a link should navigate here, rather than open a new tab or window */
export const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

/** Name a tile's elements for a transition that starts before it re-renders as the current mix */
export const nameTile = (tile: HTMLElement, number: number) => {
  const names = mixTransitionNames(number);
  tile.style.viewTransitionName = names.card;
  tile.querySelector<SVGElement>('svg')?.style.setProperty('view-transition-name', names.logo);
  tile.querySelector<HTMLElement>('h2')?.style.setProperty('view-transition-name', names.number);
};

/** view-transition-names shared by a mix's tile and its page */
export const mixTransitionNames = (number: number) => ({
  card: `mix-${number}`,
  logo: `mix-${number}-logo`,
  number: `mix-${number}-number`
});
