import { Facebook, Instagram, Mail } from 'lucide-react';
import type { ComponentType } from 'react';
import { useSiteProfile } from '../SiteProfileContext';
import { emailComposeLink, whatsappLink } from '../siteProfile';
import WhatsAppIcon from './WhatsAppIcon';

function BehanceIcon({ className }: { className?: string }) {
  return <span className={`inline-flex items-center justify-center text-[13px] font-bold leading-none ${className ?? ''}`} aria-hidden="true">Bē</span>;
}

export type SocialLink = { key: string; label: string; href: string; Icon: ComponentType<{ className?: string }> };

/** Social links from the admin-managed site profile; empty entries are left out. */
export function useSocialLinks(): SocialLink[] {
  const { socials } = useSiteProfile();
  return [
    { key: 'facebook', label: 'Facebook', href: socials.facebook, Icon: Facebook },
    { key: 'instagram', label: 'Instagram', href: socials.instagram, Icon: Instagram },
    { key: 'behance', label: 'Behance', href: socials.behance, Icon: BehanceIcon },
    { key: 'whatsapp', label: 'WhatsApp', href: whatsappLink(socials.whatsapp), Icon: WhatsAppIcon },
    { key: 'email', label: 'Email', href: emailComposeLink(socials.email), Icon: Mail },
  ].filter((link) => Boolean(link.href));
}
