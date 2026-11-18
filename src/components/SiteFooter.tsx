import { Fragment } from 'react';
import { ArrowUp } from 'lucide-react';
import { websiteCopy, type WebsiteCopy } from '../websiteSections/copy';
import { NativeElementSlot } from '../websiteSections/NativeElements';
import { EditableLabel, EditableText, useEditable } from '../websiteSections/EditableText';
import { useSiteProfile } from '../SiteProfileContext';
import { useSocialLinks, type SocialLink } from './socialLinks';

function FooterSocial({ link }: { link: SocialLink }) {
  const editable = useEditable(`site-footer.social.${link.key}`, 'link', link.label);
  if (editable.gone) return null;
  return (
    <a {...editable.attrs} href={link.href} target="_blank" rel="noreferrer" className="ed-link text-[15px]">
      {link.label}
    </a>
  );
}

export default function SiteFooter({ content }: { content?: WebsiteCopy }) {
  const profile = useSiteProfile();
  const socialLinks = useSocialLinks();
  const topLink = useEditable('site-footer.top-link', 'button', '„ზემოთ“ ღილაკი');
  const wordmark = useEditable('site-footer.wordmark', 'item', 'დიდი წარწერა');
  const copyrightLine = useEditable('site-footer.copyright-line', 'text', 'საავტორო ტექსტი', ['hide', 'copy:site-footer.copyright']);
  const location = useEditable('site-footer.location', 'item', 'მდებარეობა');
  const year = new Date().getFullYear();
  const copyright = websiteCopy(content, 'copyright', '© {year} Luka Imagines. გრაფიკული დიზაინი, ბრენდინგი და ვიზუალური იდენტობა.').replace('{year}', String(year));
  return (
    <footer id="site-footer" role="contentinfo" data-website-section="site-footer" className="content-layer border-t border-[var(--brand-line)] px-[var(--section-space-x)]">
      <div className="container-xl pt-16">
        <div className="ed-grid gap-y-8">
          <div className="ed-aside">
            <NativeElementSlot id="site-footer.brand"><span className="ed-kicker">
              <EditableText field="role">{websiteCopy(content, 'role', 'გრაფიკული დიზაინერი')}</EditableText>
            </span></NativeElementSlot>
          </div>
          <nav aria-label="სოციალური ბმულები" className="ed-main flex flex-wrap items-center gap-x-10 gap-y-4">
            {socialLinks.map((link) => <Fragment key={link.key}><FooterSocial link={link} /></Fragment>)}
            {!topLink.gone && (
              <button
                {...topLink.attrs}
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="ed-link ml-auto text-[15px]"
              >
                <EditableLabel id="site-footer.top-link" fallback="ზემოთ" />
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
            )}
          </nav>
        </div>

        {!wordmark.gone && (
          <p {...wordmark.attrs} className="footer-wordmark mt-16 overflow-hidden" aria-hidden="true">
            <EditableLabel id="site-footer.wordmark" fallback="Luka Imagines" />
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--brand-line)] py-8 pr-16 sm:flex-row sm:items-center sm:justify-between">
          {!copyrightLine.gone && <NativeElementSlot id="site-footer.copyright"><p {...copyrightLine.attrs} className="text-[13px] leading-6 text-[var(--brand-muted)]">
            {copyright}
          </p></NativeElementSlot>}
          {!location.gone && <p {...location.attrs} className="text-[13px] text-[var(--brand-soft)]">{profile.location}</p>}
        </div>
      </div>
    </footer>
  );
}
