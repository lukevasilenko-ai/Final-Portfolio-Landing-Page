/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, Facebook, Instagram, Mail, Clock, MapPin, Sparkles } from 'lucide-react';
import { HERO_ARTWORK } from '../data';

export default function Hero() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const handleScrollToProjects = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.querySelector('#projects');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home" className="section-wrap flex min-h-[88vh] items-center pt-28 sm:pt-32">
      <div className="container-xl grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-x-16 lg:gap-y-8">
        <div className="flex flex-col items-start gap-6">
          <motion.div
            initial={{ opacity: 0, x: -14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="eyebrow"
          >
            <span className="eyebrow-dot" />
            <Sparkles className="h-3.5 w-3.5 text-[var(--brand-copper)]" />
            გრაფიკული დიზაინერი
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.16 }}
          >
            <h1 className="hero-title">
              <span className="font-lgv-anastasia block">ესთეტიკა,</span>
              <span className="font-lgv-anastasia block">იდეა და ხასიათი</span>
              <span className="hero-accent font-elene-akhvlediani block">ერთ დიზაინში</span>
            </h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.24 }}
            className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
          >
            <a href="#projects" onClick={handleScrollToProjects} className="button-primary">
              ნამუშევრების დათვალიერება
              <ArrowDown className="h-4 w-4" />
            </a>

            <div className="flex items-center gap-2">
              <a
                href="https://www.facebook.com/luka.vasilenko.2025/"
                target="_blank"
                rel="noreferrer"
                className="icon-button"
                aria-label="Facebook Profile"
              >
                <Facebook className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/lukaaa.1.7/"
                target="_blank"
                rel="noreferrer"
                className="icon-button"
                aria-label="Instagram Profile"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a
                href="https://mail.google.com/mail/?view=cm&fs=1&to=lukevasilenko%40gmail.com"
                target="_blank"
                rel="noreferrer"
                className="icon-button"
                aria-label="Email Me"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </motion.div>

        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.24 }}
          className="relative lg:row-span-2"
        >
          <div className="surface-card-strong overflow-hidden p-2">
            <div className="relative aspect-square overflow-hidden rounded-lg">
              <img
                src={HERO_ARTWORK}
                alt="ავეჯის სარეკლამო პოსტერი"
                className="h-full w-full object-cover"
              />
              <div className="absolute bottom-3 right-3 rounded-lg border border-white/55 bg-white/70 px-4 py-2 text-sm font-bold text-[var(--brand-ink)] shadow-[var(--brand-shadow-soft)] backdrop-blur-md">
                ბოლო ნამუშევარი
              </div>
            </div>
          </div>

        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.32 }}
          className="lead-copy lg:col-start-1 lg:row-start-2"
        >
          გამარჯობა, მე ვარ ლუკა ვასილენკო. მე ვქმნი თვალშისაცემ ვიზუალურ პროდუქტებს, სადაც კრეატიული იდეები და ვიზუალური მინიმალიზმი ერთმანეთს ერწყმის. სპეციალიზებული ვარ სოც. მედია პოსტერების, ლოგოების, ბანერების, სავიზიტო ბარათების, ბრენდინგისა და რებრენდინგის მიმართულებით. ვმუშაობ Adobe Photoshop-სა და Adobe Illustrator-ში.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.4 }}
          className="surface-card grid w-full grid-cols-1 gap-4 p-4 sm:grid-cols-3 sm:p-5 lg:col-span-2"
        >
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-4 w-4 text-[var(--brand-accent)]" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">მდებარეობა</p>
              <p className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">საქართველო, ქუთაისი</p>
            </div>
          </div>

          <div className="flex items-start gap-3 sm:border-l sm:border-[var(--brand-line)] sm:pl-4">
            <Clock className="mt-0.5 h-4 w-4 text-[var(--brand-copper)]" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">ადგილობრივი დრო</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[var(--brand-ink)]">
                <span>{formatTime(time)}</span>
                <span className="font-mono text-[10px] font-normal text-[var(--brand-muted)]">BST</span>
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 sm:border-l sm:border-[var(--brand-line)] sm:pl-4">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--brand-success)]" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">სტატუსი</p>
              <p className="mt-1 text-sm font-semibold text-[var(--brand-ink)]">პროექტების მიღება აქტიურია</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
