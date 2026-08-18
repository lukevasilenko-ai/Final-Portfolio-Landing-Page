export const assistantKnowledge = {
  profile: {
    brand: 'Luka Imagines',
    name: 'Luka Vasilenko',
    role: {
      ka: 'პროფესიონალი გრაფიკული დიზაინერი',
      en: 'Professional graphic designer'
    },
    location: {
      ka: 'ქუთაისი, საქართველო',
      en: 'Kutaisi, Georgia'
    },
    experience: {
      ka: '2+ წლის გამოცდილება',
      en: '2+ years of experience'
    },
    about: {
      ka: 'სპეციალიზაცია მოიცავს სარეკლამო პოსტერებს, ლოგოებს, ბანერებს, ბრენდინგსა და საბეჭდ მასალებს. სამუშაოში მთავარი აქცენტებია კომპოზიცია, ტიპოგრაფია, ფერთა ჰარმონია და ბეჭდვისთვის ზუსტი მომზადება.',
      en: 'Specializes in advertising posters, logos, banners, branding, and print materials, with an emphasis on composition, typography, color harmony, and accurate pre-press preparation.'
    },
    tools: ['Adobe Photoshop', 'Adobe Illustrator']
  },
  services: [
    {
      id: 'poster',
      name: { ka: 'პოსტერის დიზაინი', en: 'Poster design' },
      price: { currency: 'GEL', min: 100, max: 130 },
      notes: {
        ka: 'ერთი პოსტერის საორიენტაციო ფასი.',
        en: 'Estimated price for one poster.'
      }
    },
    {
      id: 'cover',
      name: { ka: 'ქავერის დიზაინი', en: 'Cover design' },
      price: { currency: 'GEL', min: 70, max: 100 },
      notes: {
        ka: 'Facebook, YouTube, LinkedIn ან სხვა პლატფორმისთვის.',
        en: 'For Facebook, YouTube, LinkedIn, or another platform.'
      }
    },
    {
      id: 'template-poster',
      name: { ka: 'შაბლონური პოსტერი', en: 'Template poster' },
      price: { currency: 'GEL', fixed: 140 },
      notes: {
        ka: 'ფასი მოიცავს ერთ შაბლონურ პოსტერს. თითო ცვლილება ღირს 20 ლარი.',
        en: 'The price covers one template poster. Each change costs 20 GEL.'
      }
    },
    {
      id: 'business-cards',
      name: { ka: 'სავიზიტო ბარათების დიზაინი', en: 'Business card design' },
      price: { currency: 'GEL', min: 50, max: 70 },
      notes: {
        ka: 'დიზაინის საორიენტაციო ფასი.',
        en: 'Estimated design price.'
      }
    },
    {
      id: 'google-review-set',
      name: { ka: 'Google Review Set', en: 'Google Review Set' },
      price: { currency: 'GEL', min: 150, max: 250 },
      notes: {
        ka: 'დიზაინის საორიენტაციო ფასი.',
        en: 'Estimated design price.'
      }
    },
    {
      id: 'branding-identity',
      name: { ka: 'ბრენდინგი და ვიზუალური იდენტობა', en: 'Branding and visual identity' },
      price: null,
      notes: {
        ka: 'ფასი განისაზღვრება ბრიფისა და სამუშაოს მოცულობის მიხედვით.',
        en: 'Pricing is confirmed after reviewing the brief and project scope.'
      }
    },
    {
      id: 'logo-design',
      name: { ka: 'ლოგოს დიზაინი', en: 'Logo design' },
      price: null,
      notes: {
        ka: 'ფიქსირებული ფასი გამოქვეყნებული არ არის; საჭიროა ინდივიდუალური შეფასება.',
        en: 'No fixed price is published; a custom estimate is required.'
      }
    },
    {
      id: 'billboards-print',
      name: { ka: 'ბილბორდები და საბეჭდი მასალები', en: 'Billboards and print materials' },
      price: null,
      notes: {
        ka: 'ფასი განისაზღვრება ფორმატის, მოცულობისა და ბრიფის მიხედვით.',
        en: 'Pricing depends on format, scope, and the brief.'
      }
    }
  ],
  prices: {
    currency: 'GEL',
    policies: [
      {
        ka: 'სასწრაფო ვადა კალკულატორში ფასს 20%-ით ზრდის.',
        en: 'The calculator adds 20% for urgent delivery.'
      },
      {
        ka: 'დამატებითი ზომა პოსტერის, ქავერისა და შაბლონური პოსტერისთვის თითო ერთეულზე 15 ლარია.',
        en: 'An additional size for a poster, cover, or template poster is 15 GEL per item.'
      },
      {
        ka: 'ყველა ფასი საორიენტაციოა; ზუსტი ღირებულება დასტურდება ბრიფისა და მოცულობის განხილვის შემდეგ.',
        en: 'All prices are estimates; the exact quote is confirmed after the brief and scope are reviewed.'
      }
    ]
  },
  packages: {
    ka: 'ფიქსირებული პაკეტები ამჟამად გამოქვეყნებული არ არის. პაკეტის ღირებულება ინდივიდუალურად უნდა შეთანხმდეს.',
    en: 'No fixed packages are currently published. Package pricing must be agreed individually.'
  },
  workflow: [
    {
      step: 1,
      ka: 'გამოგზავნეთ პროექტის მოკლე ბრიფი საკონტაქტო ფორმით, ელფოსტით ან ტელეფონით.',
      en: 'Send a short project brief through the contact form, by email, or by phone.'
    },
    {
      step: 2,
      ka: 'ბრიფისა და სამუშაოს მოცულობის ნახვის შემდეგ დასტურდება ზუსტი ფასი და შემდგომი დეტალები.',
      en: 'After the brief and scope are reviewed, the exact price and next steps are confirmed.'
    }
  ],
  revisionPolicy: {
    ka: 'გამოქვეყნებული ცვლილების ფასი მხოლოდ შაბლონურ პოსტერს ეხება: თითო ცვლილება 20 ლარი. სხვა სერვისების ცვლილებების პირობები საჯაროდ მითითებული არ არის და პროექტის დაწყებამდე უნდა შეთანხმდეს.',
    en: 'The only published revision price is for template posters: 20 GEL per change. Revision terms for other services are not publicly listed and should be agreed before the project starts.'
  },
  contact: {
    email: 'lukevasilenko@gmail.com',
    phone: '+995 595 21 32 16',
    location: { ka: 'ქუთაისი, საქართველო', en: 'Kutaisi, Georgia' },
    publishedHours: '09:00-18:00 GMT',
    websiteForm: {
      ka: 'საკონტაქტო ფორმა მდებარეობს ამავე გვერდის „კონტაქტი“ განყოფილებაში.',
      en: 'The contact form is in the Contact section on this page.'
    }
  },
  portfolio: {
    categories: ['Product Posters', 'Branding & Identity', 'Billboards & Print'],
    featuredProjects: [
      {
        title: 'Focus · ფოკუსი',
        category: 'Branding & Identity',
        summary: {
          ka: 'ოპტიკის მაღაზიის ბრენდინგისა და ვიზუალური იდენტობის პროექტი.',
          en: 'A branding and visual identity project for an optics store.'
        },
        tools: ['Adobe Photoshop', 'Adobe Illustrator']
      }
    ]
  },
  frequentlyAskedQuestions: [
    {
      question: { ka: 'რა ღირს სოციალური მედიის დიზაინი?', en: 'How much does social media design cost?' },
      answer: {
        ka: 'პოსტერი დაახლოებით 100-130 ლარი ღირს, ქავერი 70-100 ლარი, ხოლო შაბლონური პოსტერი 140 ლარი და თითო ცვლილება 20 ლარი.',
        en: 'A poster is estimated at 100-130 GEL, a cover at 70-100 GEL, and a template poster at 140 GEL plus 20 GEL per change.'
      }
    },
    {
      question: { ka: 'როგორ შევუკვეთო დიზაინი?', en: 'How do I order a design?' },
      answer: {
        ka: 'გამოგზავნეთ მოკლე ბრიფი საკონტაქტო ფორმით ან გამოიყენეთ მითითებული ელფოსტა და ტელეფონი.',
        en: 'Send a short brief through the contact form, or use the listed email address or phone number.'
      }
    },
    {
      question: { ka: 'რამდენი ცვლილება შედის ფასში?', en: 'How many revisions are included?' },
      answer: {
        ka: 'საჯაროდ მითითებულია მხოლოდ შაბლონური პოსტერის ცვლილების ფასი: თითო ცვლილება 20 ლარი. სხვა პირობები ინდივიდუალურად თანხმდება.',
        en: 'Only the template-poster change price is published: 20 GEL per change. Other revision terms are agreed individually.'
      }
    }
  ]
} as const;

export type AssistantKnowledge = typeof assistantKnowledge;
