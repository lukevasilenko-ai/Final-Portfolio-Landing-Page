import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { compileStyleMap } from './siteElementStyles';
import { supabase } from './lib/supabase';
import { DEFAULT_SITE_PROFILE, loadSiteProfile, type SiteProfile, type SiteProfileClient } from './siteProfile';
import { EMPTY_SITE_ELEMENTS, loadSiteElements, type SiteElements, type SiteElementsClient } from './siteElements';

const SiteProfileContext = createContext<SiteProfile>(DEFAULT_SITE_PROFILE);
const SiteElementsContext = createContext<SiteElements>(EMPTY_SITE_ELEMENTS);

/**
 * Loads the published site profile and per-element changes once (read-only) and applies the
 * profile's SEO title and description. `elementsOverride` lets the admin editor's preview show
 * unsaved element changes instead of the published ones.
 */
export function SiteProfileProvider({ children, elementsOverride }: { children: ReactNode; elementsOverride?: SiteElements | null }) {
  const [profile, setProfile] = useState<SiteProfile>(DEFAULT_SITE_PROFILE);
  const [elements, setElements] = useState<SiteElements>(EMPTY_SITE_ELEMENTS);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    loadSiteProfile(supabase as unknown as SiteProfileClient)
      .then((loaded) => { if (active && loaded) setProfile(loaded); })
      .catch(() => { /* keep defaults when offline or not saved yet */ });
    // "?preview=draft" (opened from the editor) shows the admin's unpublished draft; visitors
    // can't read draft rows, so for them this falls back to the published changes.
    const wantsDraft = new URLSearchParams(window.location.search).get('preview') === 'draft';
    const client = supabase as unknown as SiteElementsClient;
    (wantsDraft ? loadSiteElements(client, true).then((draft) => draft ?? loadSiteElements(client)) : loadSiteElements(client))
      .then((loaded) => { if (active && loaded) setElements(loaded); })
      .catch(() => { /* keep the site as designed */ });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.title = profile.seo.title;
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', profile.seo.description);
    }
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', profile.seo.title);
    }
  }, [profile]);

  const active = elementsOverride ?? elements;
  const css = useMemo(() => compileStyleMap(active.style), [active.style]);

  return (
    <SiteProfileContext.Provider value={profile}>
      <SiteElementsContext.Provider value={active}>
        {/* Style changes from the visual editor; generated from validated values only. */}
        {css && <style data-site-element-styles="">{css}</style>}
        {children}
      </SiteElementsContext.Provider>
    </SiteProfileContext.Provider>
  );
}

export const useSiteProfile = () => useContext(SiteProfileContext);
export const useSiteElements = () => useContext(SiteElementsContext);
