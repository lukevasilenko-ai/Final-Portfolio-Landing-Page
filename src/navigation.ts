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

/**
 * Follows a link that may have been changed in the visual editor: "#section" scrolls on the
 * page, "/path" navigates inside the site, anything else (https, mailto, tel) opens normally.
 * Returns true when it handled the click itself.
 */
export const followSiteLink = (href: string) => {
  if (href.startsWith('#')) {
    const target = document.getElementById(decodeURIComponent(href.slice(1)));
    if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
    navigateWithinSite(`/${href}`);
    return true;
  }
  if (href.startsWith('/') && !href.startsWith('//')) { navigateWithinSite(href); return true; }
  return false;
};

/** External links open in a new tab; in-site ones don't. */
export const isExternalLink = (href: string) => /^(https?:|mailto:|tel:)/i.test(href);
