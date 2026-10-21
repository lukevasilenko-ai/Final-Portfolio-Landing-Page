/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Copy,
  Crosshair,
  Layers3,
  Megaphone,
  Palette,
  PenTool,
  Printer,
  RefreshCw,
  Rocket,
  Sparkles
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import WhatsAppIcon from './WhatsAppIcon';

type ServiceId = 'identity' | 'social' | 'campaign' | 'print';
type GoalId = 'launch' | 'attention' | 'refresh' | 'consistency';
type MoodId = 'minimal' | 'bold' | 'premium' | 'expressive';

interface ServiceOption {
  id: ServiceId;
  label: string;
  caption: string;
  icon: typeof Palette;
  focus: string;
  deliverables: string[];
}

interface GoalOption {
  id: GoalId;
  label: string;
  icon: typeof Rocket;
  outcome: string;
}

interface MoodOption {
  id: MoodId;
  label: string;
  title: string;
  approach: string;
  palette: [string, string, string, string];
}

const SERVICES: ServiceOption[] = [
  {
    id: 'identity',
    label: 'ბრენდინგი',
    caption: 'ლოგო და ვიზუალური სისტემა',
    icon: PenTool,
    focus: 'ერთიანი იდენტობა, რომელიც ყველა შეხების წერტილში ადვილად ამოსაცნობი იქნება.',
    deliverables: ['ლოგოს მიმართულება', 'ფერების სისტემა', 'ტიპოგრაფია']
  },
  {
    id: 'social',
    label: 'სოციალური მედია',
    caption: 'პოსტერები და კონტენტის სტილი',
    icon: Layers3,
    focus: 'მოქნილი ვიზუალური სისტემა, რომელიც სხვადასხვა ფორმატში ერთიანად იმუშავებს.',
    deliverables: ['პოსტერის სტილი', 'Story ფორმატი', 'კონტენტის სისტემა']
  },
  {
    id: 'campaign',
    label: 'კამპანია',
    caption: 'მთავარი ვიზუალი და ადაპტაციები',
    icon: Megaphone,
    focus: 'ძლიერი მთავარი ვიზუალი, მკაფიო აქცენტითა და კამპანიისთვის დამახსოვრებადი რიტმით.',
    deliverables: ['Key visual', 'სარეკლამო ფორმატები', 'კომპოზიციის წესი']
  },
  {
    id: 'print',
    label: 'საბეჭდი დიზაინი',
    caption: 'პრემიუმ ფიზიკური მასალები',
    icon: Printer,
    focus: 'მასალაზე, ფორმატსა და ბეჭდვის ტექნიკაზე მორგებული ზუსტი ვიზუალური გადაწყვეტა.',
    deliverables: ['ბეჭდვის კონცეფცია', 'მასალის მიმართულება', 'Pre-press ფაილები']
  }
];

const GOALS: GoalOption[] = [
  {
    id: 'launch',
    label: 'ახალი ბრენდის გაშვება',
    icon: Rocket,
    outcome: 'პირველი შთაბეჭდილება უნდა იყოს მკაფიო, თავდაჯერებული და დასამახსოვრებელი.'
  },
  {
    id: 'attention',
    label: 'მეტი ყურადღების მოზიდვა',
    icon: Crosshair,
    outcome: 'მთავარი გზავნილი სწრაფად უნდა იკითხებოდეს და კონკურენტულ გარემოში გამოირჩეოდეს.'
  },
  {
    id: 'refresh',
    label: 'ვიზუალური განახლება',
    icon: RefreshCw,
    outcome: 'არსებული ხასიათი უნდა შენარჩუნდეს, მაგრამ ვიზუალი უფრო თანამედროვე და მოქნილი გახდეს.'
  },
  {
    id: 'consistency',
    label: 'ერთიანი სტილის შექმნა',
    icon: BadgeCheck,
    outcome: 'ყველა ფორმატი უნდა დაეყრდნოს ერთ წესს და ბრენდი ნებისმიერ არხში ამოსაცნობი დარჩეს.'
  }
];

const MOODS: MoodOption[] = [
  {
    id: 'minimal',
    label: 'მინიმალური',
    title: 'სუფთა და მიზანმიმართული',
    approach: 'თავისუფალი სივრცე, მკაფიო იერარქია და ზუსტად შერჩეული დეტალები.',
    palette: [
      'var(--brand-panel-solid)',
      'var(--brand-accent)',
      'var(--brand-ink)',
      'var(--brand-page-soft)'
    ]
  },
  {
    id: 'bold',
    label: 'თამამი',
    title: 'ენერგიული და თვალშისაცემი',
    approach: 'მასშტაბური ტიპოგრაფია, მაღალი კონტრასტი და ძლიერი ფერადი აქცენტი.',
    palette: [
      'var(--brand-accent)',
      'var(--brand-copper)',
      'var(--brand-ink)',
      'var(--brand-panel-solid)'
    ]
  },
  {
    id: 'premium',
    label: 'პრემიუმ',
    title: 'დახვეწილი და თავდაჯერებული',
    approach: 'შეკავებული პალიტრა, ელეგანტური რიტმი და ხარისხზე ორიენტირებული დეტალები.',
    palette: [
      'var(--brand-ink)',
      'var(--brand-accent)',
      'var(--brand-copper)',
      'var(--brand-panel-solid)'
    ]
  },
  {
    id: 'expressive',
    label: 'ექსპრესიული',
    title: 'ცოცხალი და გამორჩეული',
    approach: 'მოულოდნელი ფერთა წყვილები, დინამიკური ფორმები და ხასიათიანი კომპოზიცია.',
    palette: [
      'var(--brand-plum)',
      'var(--brand-copper)',
      'var(--brand-accent)',
      'var(--brand-panel-solid)'
    ]
  }
];

const WHATSAPP_NUMBER = '995595213216';
const smoothEase = [0.16, 1, 0.3, 1] as const;

const getOption = <T extends { id: string }>(options: T[], id: string) =>
  options.find((option) => option.id === id) ?? options[0];

export default function CreativeBriefStudio() {
  const reduceMotion = useReducedMotion();
  const [serviceId, setServiceId] = useState<ServiceId>('identity');
  const [goalId, setGoalId] = useState<GoalId>('launch');
  const [moodId, setMoodId] = useState<MoodId>('minimal');
  const [projectName, setProjectName] = useState('');
  const [copied, setCopied] = useState(false);
  const copyResetTimer = useRef<number | null>(null);

  const service = getOption(SERVICES, serviceId);
  const goal = getOption(GOALS, goalId);
  const mood = getOption(MOODS, moodId);
  const displayName = projectName.trim() || 'თქვენი ბრენდი';
  const monogram = displayName.charAt(0).toLocaleUpperCase('ka-GE') || 'L';

  const briefText = useMemo(() => {
    const lines = [
      'გამარჯობა, მინდა პროექტის განხილვა Creative Brief Studio-დან.',
      projectName.trim() ? `პროექტი / ბრენდი: ${projectName.trim()}` : null,
      `მომსახურება: ${service.label}`,
      `მიზანი: ${goal.label}`,
      `ვიზუალური ხასიათი: ${mood.label}`,
      `შემოთავაზებული მიმართულება: ${mood.title}`,
      `საწყისი მოცულობა: ${service.deliverables.join(', ')}`
    ];

    return lines.filter(Boolean).join('\n');
  }, [goal.label, mood.label, mood.title, projectName, service.deliverables, service.label]);

  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(briefText)}`;
  const boardStyle = {
    '--brief-color-1': mood.palette[0],
    '--brief-color-2': mood.palette[1],
    '--brief-color-3': mood.palette[2],
    '--brief-color-4': mood.palette[3]
  } as CSSProperties;

  useEffect(() => () => {
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(briefText);
      setCopied(true);

      if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
      copyResetTimer.current = window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section id="brief-studio" className="section-wrap section-rule">
      <div className="container-xl">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-90px' }}
          transition={{ duration: reduceMotion ? 0 : 0.58, ease: smoothEase }}
          className="mb-12 grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.42fr)] lg:items-end"
        >
          <div className="flex flex-col gap-5">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              04 // Creative Brief Studio
            </span>
            <h2 className="section-title">იპოვეთ თქვენი პროექტის ვიზუალური მიმართულება.</h2>
          </div>
          <p className="section-subtitle lg:pb-1">
            რამდენიმე არჩევანი საკმარისია საწყისი art direction-ისა და მომზადებული საკომუნიკაციო ბრიფის მისაღებად.
          </p>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: reduceMotion ? 0 : 0.68, delay: reduceMotion ? 0 : 0.08, ease: smoothEase }}
          className="creative-brief-studio grid grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]"
        >
          <div className="flex flex-col gap-8 p-5 sm:p-8 lg:p-10">
            <div className="flex flex-col gap-3 border-b border-[var(--brand-line)] pb-7 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <span className="font-mono text-[10px] font-bold uppercase text-[var(--brand-soft)]">Brief builder</span>
                <h3 className="mt-2 text-2xl font-extrabold text-[var(--brand-ink)]">სამი არჩევანი. ერთი მკაფიო მიმართულება.</h3>
              </div>
              <span className="status-pill flex w-fit items-center gap-2 px-3 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-success)]" />
                03 / 03 მზადაა
              </span>
            </div>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 flex items-center gap-3 text-sm font-extrabold text-[var(--brand-ink)]">
                <span className="brief-step-index">01</span>
                აირჩიეთ მომსახურება
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SERVICES.map((option) => {
                  const OptionIcon = option.icon;
                  const isActive = serviceId === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setServiceId(option.id)}
                      className={`brief-choice${isActive ? ' is-active' : ''}`}
                    >
                      <span className="brief-choice-icon">
                        <OptionIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <strong className="block text-sm text-[var(--brand-ink)]">{option.label}</strong>
                        <span className="mt-1 block text-xs leading-5 text-[var(--brand-muted)]">{option.caption}</span>
                      </span>
                      {isActive && <Check className="ml-auto h-4 w-4 shrink-0 text-[var(--brand-accent)]" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 flex items-center gap-3 text-sm font-extrabold text-[var(--brand-ink)]">
                <span className="brief-step-index">02</span>
                რა არის მთავარი მიზანი?
              </legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {GOALS.map((option) => {
                  const OptionIcon = option.icon;
                  const isActive = goalId === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setGoalId(option.id)}
                      className={`brief-choice brief-choice-compact${isActive ? ' is-active' : ''}`}
                    >
                      <OptionIcon className="h-4 w-4 shrink-0" />
                      <span className="text-sm font-bold">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-3 flex items-center gap-3 text-sm font-extrabold text-[var(--brand-ink)]">
                <span className="brief-step-index">03</span>
                როგორი ხასიათი უნდა ჰქონდეს?
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {MOODS.map((option) => {
                  const isActive = moodId === option.id;

                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setMoodId(option.id)}
                      className={`brief-mood-choice${isActive ? ' is-active' : ''}`}
                    >
                      <span className="brief-mood-swatch" style={{ background: option.palette[1] }} />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex flex-col gap-2 border-t border-[var(--brand-line)] pt-7">
              <label htmlFor="brief-project-name" className="font-mono text-[10px] font-bold uppercase text-[var(--brand-muted)]">
                ბრენდის ან პროექტის სახელი / სურვილისამებრ
              </label>
              <input
                id="brief-project-name"
                type="text"
                maxLength={40}
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="მაგ: Focus"
                className="field-control"
              />
            </div>
          </div>

          <div className="brief-preview-pane flex min-w-0 flex-col gap-6 border-t border-[var(--brand-line-strong)] p-5 sm:p-8 lg:border-l lg:border-t-0 lg:p-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[var(--brand-ink)]">
                <Sparkles className="h-4 w-4 text-[var(--brand-copper)]" />
                Live art direction
              </div>
              <span className="font-mono text-[10px] font-bold uppercase text-[var(--brand-soft)]">Updates instantly</span>
            </div>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`${serviceId}-${goalId}-${moodId}`}
                initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.99 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -8, scale: 0.995 }}
                transition={{ duration: reduceMotion ? 0 : 0.34, ease: smoothEase }}
                className="brief-direction-board"
                style={boardStyle}
                aria-live="polite"
              >
                <div className="brief-board-header">
                  <span>Creative direction / 01</span>
                  <span>{service.label}</span>
                </div>

                <div className="brief-board-name">{displayName}</div>

                <div className="brief-board-composition">
                  <div className="brief-board-monogram" aria-hidden="true">{monogram}</div>
                  <div className="brief-board-copy">
                    <span className="brief-board-kicker">Selected mood</span>
                    <strong>{mood.title}</strong>
                    <p>{mood.approach}</p>
                  </div>
                </div>

                <div className="brief-board-palette" aria-label="შემოთავაზებული ფერთა მიმართულება">
                  {mood.palette.map((color, index) => (
                    <span
                      key={`${mood.id}-${index}`}
                      style={{ background: color }}
                      title={`ფერი ${index + 1}`}
                    />
                  ))}
                </div>

                <div className="brief-board-footer">
                  <span>Goal / {goal.label}</span>
                  <Palette className="h-4 w-4" />
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-5 border-t border-[var(--brand-line)] pt-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="min-w-0">
                <span className="font-mono text-[10px] font-bold uppercase text-[var(--brand-soft)]">მიმართულების იდეა</span>
                <p className="mt-2 text-sm leading-7 text-[var(--brand-muted)]">
                  {goal.outcome} {service.focus}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {service.deliverables.map((deliverable) => (
                    <span key={deliverable} className="tag-chip px-3 py-1.5">{deliverable}</span>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="icon-button shrink-0"
                aria-label={copied ? 'ბრიფი დაკოპირებულია' : 'ბრიფის კოპირება'}
                title={copied ? 'დაკოპირებულია' : 'ბრიფის კოპირება'}
              >
                <AnimatePresence initial={false} mode="wait">
                  <motion.span
                    key={copied ? 'copied' : 'copy'}
                    initial={{ opacity: 0, scale: 0.75 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.75 }}
                    transition={{ duration: 0.16 }}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </div>

            <div className="mt-auto flex flex-col gap-3 border-t border-[var(--brand-line)] pt-6 sm:flex-row">
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="button-primary flex-1"
              >
                <WhatsAppIcon className="h-4 w-4" />
                ბრიფის გაგზავნა
                <ArrowUpRight className="h-4 w-4" />
              </a>
              <a href="#calculator" className="button-secondary flex-1 gap-2">
                ბიუჯეტის დათვლა
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <span className="sr-only" role="status" aria-live="polite">
              {copied ? 'ბრიფი დაკოპირებულია.' : ''}
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
