/**
 * Change route inside a view transition, so elements sharing a view-transition-name (a
 * playlist tile and its mix's page) animate between the two pages. Without support, or
 * with reduced motion, it just changes route.
 */
export const routeWithTransition = (route: (url: string) => void, url: string) => {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    route(url);
    return;
  }
  // Lets the player bar take its own transition name for now (see style.css); outside a
  // transition the name would stop its background blur
  document.documentElement.classList.add('view-transition');
  const transition = document.startViewTransition(async () => {
    route(url);
    // Preact renders the new route on the next tick; the transition captures it after this
    await new Promise(resolve => setTimeout(resolve));
  });
  transition.finished.finally(() => document.documentElement.classList.remove('view-transition'));
};

/** Whether a click on a link should navigate here, rather than open a new tab or window */
export const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;

/** view-transition-names shared by a mix's tile and its page */
export const mixTransitionNames = (number: number) => ({
  card: `mix-${number}`,
  logo: `mix-${number}-logo`,
  number: `mix-${number}-number`
});
