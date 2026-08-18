/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const navigateWithinSite = (path: string, behavior: ScrollBehavior = 'smooth') => {
  const destination = new URL(path, window.location.href);
  const nextLocation = `${destination.pathname}${destination.search}${destination.hash}`;

  window.history.pushState(null, '', nextLocation);
  window.dispatchEvent(new Event('app:navigate'));

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (destination.hash) {
        const target = document.getElementById(decodeURIComponent(destination.hash.slice(1)));

        if (target) {
          target.scrollIntoView({ behavior, block: 'start' });
          return;
        }
      }

      window.scrollTo({ top: 0, behavior });
    });
  });
};
