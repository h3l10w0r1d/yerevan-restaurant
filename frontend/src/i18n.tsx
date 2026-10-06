import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'nl'

const en = {
  nav: { menu: 'Menu', reserve: 'Reserve', order: 'Order', visit: 'Visit' },
  hero: {
    tagline: 'Armenian cooking at the hour the city lights come on and Ararat turns blue.',
    reserve: 'Reserve a table',
    menu: 'See the menu',
  },
  intro: {
    title: 'An evening in Yerevan',
    body: 'Lavash from the oven, meat over open fire, tolma the way grandmothers fold it. We cook the food of Armenia for long tables and slow evenings, a short walk from Hilversum station.',
    photo: 'Yerevan at dusk, as Ararat turns pink and then blue',
  },
  gallery: {
    title: 'From Yerevan',
    lead: 'The city we cook from, from the square at night to the mountain at dusk.',
    photos: {
      'republic-square': 'Republic Square, after dark',
      'evening-street': 'Summer evenings on the café streets',
      'ararat-dusk': 'Ararat over the city at dusk',
      'khor-virap': 'Khor Virap, at the foot of Ararat',
      cascade: 'The Cascade, from below',
      'city-lights': 'The hour the city lights come on',
    },

  },
  menu: {
    title: 'Menu',
    lead: 'Dishes to share. Ask us what is good tonight.',
    veg: 'vegetarian',
    vegan: 'vegan',
    allergens: 'Allergies or dietary needs? Tell us when you book, or ask your host.',
    add: 'Add to order',
    inOrder: 'In your order',
  },
  reserve: {
    title: 'Reserve a table',
    lead: 'Tables are held for fifteen minutes. For groups larger than twelve, write to us.',
    date: 'Date',
    datePh: 'Choose a date',
    calendar: { prev: 'Previous month', next: 'Next month', closed: 'closed' },
    guests: 'Guests',
    guestOne: '{n} guest',
    guestMany: '{n} guests',
    time: 'Time',
    pickDate: 'Choose a date to see free times.',
    closed: 'We are closed on this day.',
    noSlots: 'No free tables left on this day.',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    notes: 'Notes (optional)',
    notesPh: 'Allergies, a birthday, a high chair…',
    submit: 'Request table',
    sending: 'Sending…',
    successTitle: 'Thank you, see you soon.',
    success: 'We have your request for {guests} on {date} at {time}. We will be in touch shortly to confirm.',
    another: 'Make another reservation',
    errors: {
      fully_booked: 'That time just filled up. Please pick another.',
      closed: 'We are closed at that time.',
      in_past: 'That time has already passed.',
      date_out_of_range: 'We take reservations up to 90 days ahead.',
      generic: 'Something went wrong. Please try again, or email us.',
      offline: 'Our booking system is not reachable right now. Send your request by email instead:',
      emailCta: 'Email your request',
    },
  },
  order: {
    title: 'Order to take away',
    soonTitle: 'Coming soon',
    soon: 'Soon you will be able to order our dishes for pickup here. Until then, come by or reserve a table.',
    cart: 'Your order',
    empty: 'Your order is empty. Add dishes from the menu.',
    total: 'Total',
    pickup: 'Pickup time',
    submit: 'Place order',
    success: 'Order received. We will email you when it is confirmed.',
    remove: 'Remove',
    pay: 'You pay when you collect.',
  },
  visit: {
    title: 'Visit',
    address: 'Address',
    hours: 'Opening hours',
    contact: 'Contact',
    route: 'Directions',
    closed: 'Closed',
  },
  ed: {
    issue: 'No. 01 · Autumn 2026',
    kicker: 'Armenian kitchen · Hilversum',
    headline: ['Armenian cooking', 'at the hour the', 'city lights come on.'],
    heroFig: 'Ararat over Yerevan, at dusk',
    find: 'Find us',
    tonight: 'Tonight',
    closedToday: 'Closed today, open again tomorrow',
    book: 'Book',
    introKicker: 'The kitchen',
    pull: '“Lavash from the oven, meat over open fire, and a table that never quite empties.”',
    introBody2: 'Most dishes are meant to be shared: small plates to begin, something slow from the pot, then whatever comes off the fire. Ask what is good tonight. The answer changes with the season.',
    menuKicker: 'The menu',
    menuTitle: 'Tonight’s card',
    galleryKicker: 'Postcards',
    fig: 'On the plate',
  },
  styles: { label: 'Style', classic: 'Classic', editorial: 'Magazine' },
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  footer: {
    rights: 'Armenian restaurant in Hilversum',
    credits: 'Photo credits',
    creditsNote: 'Photos via Unsplash and Wikimedia Commons, cropped and resized.',
  },
}

type Dict = typeof en

const nl: Dict = {
  nav: { menu: 'Menu', reserve: 'Reserveren', order: 'Bestellen', visit: 'Bezoek' },
  hero: {
    tagline: 'Armeens koken op het uur dat de stad oplicht en de Ararat blauw kleurt.',
    reserve: 'Reserveer een tafel',
    menu: 'Bekijk het menu',
  },
  intro: {
    title: 'Een avond in Jerevan',
    body: 'Lavash uit de oven, vlees boven open vuur, tolma zoals grootmoeders hem vouwen. Wij koken de keuken van Armenië voor lange tafels en rustige avonden, op loopafstand van station Hilversum.',
    photo: 'Jerevan bij schemering, als de Ararat roze en dan blauw kleurt',
  },
  gallery: {
    title: 'Uit Jerevan',
    lead: 'De stad waar onze keuken vandaan komt, van het plein bij nacht tot de berg bij schemering.',
    photos: {
      'republic-square': 'Republiekplein, na zonsondergang',
      'evening-street': 'Zomeravonden in de caféstraten',
      'ararat-dusk': 'De Ararat boven de stad bij schemering',
      'khor-virap': 'Khor Virap, aan de voet van de Ararat',
      cascade: 'De Cascade, van onderaf',
      'city-lights': 'Het uur waarop de stad oplicht',
    },

  },
  menu: {
    title: 'Menu',
    lead: 'Gerechten om te delen. Vraag ons wat er vanavond goed is.',
    veg: 'vegetarisch',
    vegan: 'veganistisch',
    allergens: 'Allergieën of dieetwensen? Laat het weten bij het reserveren, of vraag het je gastheer.',
    add: 'Toevoegen',
    inOrder: 'In je bestelling',
  },
  reserve: {
    title: 'Reserveer een tafel',
    lead: 'We houden je tafel vijftien minuten vast. Met meer dan twaalf personen? Mail ons.',
    date: 'Datum',
    datePh: 'Kies een datum',
    calendar: { prev: 'Vorige maand', next: 'Volgende maand', closed: 'gesloten' },
    guests: 'Personen',
    guestOne: '{n} persoon',
    guestMany: '{n} personen',
    time: 'Tijd',
    pickDate: 'Kies een datum om vrije tijden te zien.',
    closed: 'Op deze dag zijn we gesloten.',
    noSlots: 'Er zijn geen tafels meer vrij op deze dag.',
    name: 'Naam',
    email: 'E-mail',
    phone: 'Telefoon',
    notes: 'Opmerkingen (optioneel)',
    notesPh: 'Allergieën, een verjaardag, een kinderstoel…',
    submit: 'Tafel aanvragen',
    sending: 'Versturen…',
    successTitle: 'Dank je wel, tot snel.',
    success: 'We hebben je aanvraag voor {guests} op {date} om {time}. We nemen snel contact op om te bevestigen.',
    another: 'Nog een reservering maken',
    errors: {
      fully_booked: 'Die tijd is net volgeboekt. Kies een andere tijd.',
      closed: 'Op dat moment zijn we gesloten.',
      in_past: 'Die tijd is al voorbij.',
      date_out_of_range: 'We nemen reserveringen aan tot 90 dagen vooruit.',
      generic: 'Er ging iets mis. Probeer het opnieuw of mail ons.',
      offline: 'Ons reserveringssysteem is nu niet bereikbaar. Stuur je aanvraag per e-mail:',
      emailCta: 'Mail je aanvraag',
    },
  },
  order: {
    title: 'Bestellen om mee te nemen',
    soonTitle: 'Binnenkort',
    soon: 'Binnenkort kun je hier onze gerechten bestellen om af te halen. Kom tot die tijd langs of reserveer een tafel.',
    cart: 'Je bestelling',
    empty: 'Je bestelling is leeg. Voeg gerechten toe vanuit het menu.',
    total: 'Totaal',
    pickup: 'Afhaaltijd',
    submit: 'Bestelling plaatsen',
    success: 'Bestelling ontvangen. We mailen je zodra hij bevestigd is.',
    remove: 'Verwijder',
    pay: 'Je betaalt bij het afhalen.',
  },
  visit: {
    title: 'Bezoek',
    address: 'Adres',
    hours: 'Openingstijden',
    contact: 'Contact',
    route: 'Route',
    closed: 'Gesloten',
  },
  ed: {
    issue: 'Nr. 01 · Herfst 2026',
    kicker: 'Armeense keuken · Hilversum',
    headline: ['Armeens koken', 'op het uur dat', 'de stad oplicht.'],
    heroFig: 'De Ararat boven Jerevan, bij schemering',
    find: 'Adres',
    tonight: 'Vanavond',
    closedToday: 'Vandaag gesloten, morgen weer open',
    book: 'Reserveren',
    introKicker: 'De keuken',
    pull: '“Lavash uit de oven, vlees boven open vuur, en een tafel die nooit helemaal leeg raakt.”',
    introBody2: 'De meeste gerechten zijn om te delen: kleine bordjes om te beginnen, iets langzaams uit de pan, dan wat er van het vuur komt. Vraag wat er vanavond goed is. Het antwoord verandert met het seizoen.',
    menuKicker: 'Het menu',
    menuTitle: 'De kaart van vanavond',
    galleryKicker: 'Ansichtkaarten',
    fig: 'Op het bord',
  },
  styles: { label: 'Stijl', classic: 'Klassiek', editorial: 'Magazine' },
  days: ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'],
  footer: {
    rights: 'Armeens restaurant in Hilversum',
    credits: 'Fotoverantwoording',
    creditsNote: 'Foto’s via Unsplash en Wikimedia Commons, bijgesneden en verkleind.',
  },
}

const dicts: Record<Lang, Dict> = { en, nl }

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem('lang')
    if (saved === 'en' || saved === 'nl') return saved
  } catch { /* storage unavailable */ }
  return navigator.language?.toLowerCase().startsWith('nl') ? 'nl' : 'en'
}

const Ctx = createContext<{ lang: Lang; t: Dict; setLang: (l: Lang) => void }>({
  lang: 'en', t: en, setLang: () => {},
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)
  useEffect(() => {
    document.documentElement.lang = lang
    try { localStorage.setItem('lang', lang) } catch { /* ignore */ }
  }, [lang])
  return <Ctx.Provider value={{ lang, t: dicts[lang], setLang }}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)

export function fill(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}
