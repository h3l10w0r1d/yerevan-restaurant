import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { RefObject } from 'react'
import type { SiteStyle } from './style'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Don't re-measure when the mobile address bar slides in and out.
ScrollTrigger.config({ ignoreMobileResize: true })

// Handy for poking at timelines from the console during development.
if (import.meta.env.DEV) Object.assign(window, { gsap, ScrollTrigger })

/**
 * Page-wide scroll choreography. Everything sits behind a reduced-motion
 * media query, so users who opt out get the static page.
 */
export function useScrollAnimations(root: RefObject<HTMLElement | null>, style: SiteStyle) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      if (style === 'editorial') {
        editorial(mm)
        sharedSections(mm)
        return
      }

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero: draw Ararat, then the wordmark and copy rise in.
        const hero = gsap.timeline({ defaults: { ease: 'power3.out' } })
        hero
          .from('.hero .logo__mountain', { strokeDashoffset: 1, duration: 1.6, ease: 'power2.inOut' })
          .from('.hero .logo__word', { y: 24, opacity: 0, duration: 1 }, 0.5)
          .from('.hero .logo__sub', { y: 12, opacity: 0, duration: 0.8 }, 0.8)
          .from('.hero__tagline, .hero__cta > *, .hero__address', { y: 20, opacity: 0, duration: 0.8, stagger: 0.1 }, 1)

        // Hero content drifts up and fades as you leave it.
        gsap.to('.hero__inner', {
          yPercent: -18,
          opacity: 0.2,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        })

        // Generic reveals.
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
          gsap.from(el, {
            y: 40,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          })
        })

        // Mountain marks draw themselves when they come into view.
        gsap.utils.toArray<SVGElement>('.intro__mark .logo__mountain, .soon__mark .logo__mountain').forEach((el) => {
          gsap.from(el, {
            strokeDashoffset: 1,
            duration: 1.4,
            ease: 'power2.inOut',
            scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          })
        })

        // Ararat band: the photo drifts inside its frame (transform only, cheap on phones).
        gsap.fromTo('[data-parallax]', { yPercent: -8, scale: 1.12 }, {
          yPercent: 8,
          scale: 1.12,
          ease: 'none',
          scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: true },
        })
      })

      sharedSections(mm)

      // The band's frame opening animates clip-path, which repaints every frame; keep it to desktop.
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo('.band__frame', { clipPath: 'inset(8% 6% 8% 6%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)',
          ease: 'none',
          scrollTrigger: { trigger: '.band', start: 'top 90%', end: 'top 30%', scrub: true },
        })
      })

      // Gallery: pinned horizontal scroll on wide screens, native swipe on phones.
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        const track = document.querySelector<HTMLElement>('.gallery__track')
        if (!track) return
        const distance = () => track.scrollWidth - window.innerWidth
        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: '.gallery',
            pin: '.gallery__pin',
            start: 'top top',
            end: () => `+=${distance()}`,
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        })
        gsap.utils.toArray<HTMLElement>('.gallery__frame img').forEach((photo) => {
          gsap.fromTo(photo, { scale: 1.15 }, {
            scale: 1,
            ease: 'none',
            scrollTrigger: { trigger: '.gallery', start: 'top top', end: () => `+=${distance()}`, scrub: true },
          })
        })
      })

      mm.add('(max-width: 899px) and (prefers-reduced-motion: no-preference)', () => {
        gsap.from('.gallery__item', {
          x: 60,
          opacity: 0,
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.1,
          scrollTrigger: { trigger: '.gallery__track', start: 'top 85%', once: true },
        })
      })

    },
    { scope: root, dependencies: [style], revertOnUpdate: true },
  )
}


/** Reservation form fields and visit columns, used by both styles. */
function sharedSections(mm: gsap.MatchMedia) {
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    ;['.reserve .form > *', '.visit__grid > *'].forEach((selector) => {
      const items = gsap.utils.toArray<HTMLElement>(selector)
      if (!items.length) return
      gsap.from(items, {
        y: 28,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.06,
        scrollTrigger: { trigger: items[0], start: 'top 88%', once: true },
      })
    })
  })
}

/** Magazine choreography: set lines, drawn rules, clipped figures, layered parallax. */
function editorial(mm: gsap.MatchMedia) {
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    const intro = gsap.timeline({ defaults: { ease: 'power4.out' } })
    intro
      .from('.ed-hero .ed-rule', { scaleX: 0, transformOrigin: 'left center', duration: 1.2, stagger: 0.12 })
      .from('.ed-meta > *', { y: 10, opacity: 0, duration: 0.6, stagger: 0.08 }, 0.1)
      .from('.ed-masthead', { yPercent: 40, opacity: 0, duration: 1.2 }, 0.2)
      .from('.ed-line > span', { yPercent: 110, duration: 1.1, stagger: 0.12 }, 0.5)
      .from('.ed-hero__facts > div', { y: 16, opacity: 0, duration: 0.7, stagger: 0.1 }, 1)

    // Rules outside the hero draw in as they arrive.
    gsap.utils.toArray<HTMLElement>('.ed-section .ed-rule').forEach((rule) => {
      gsap.from(rule, {
        scaleX: 0,
        transformOrigin: 'left center',
        duration: 1.2,
        ease: 'power3.inOut',
        scrollTrigger: { trigger: rule, start: 'top 92%', once: true },
      })
    })

    gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
      gsap.from(el, {
        y: 30,
        opacity: 0,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      })
    })

    // Figures wipe open from the bottom, the photo settling as it does.
    gsap.utils.toArray<HTMLElement>('[data-ed-clip]').forEach((el) => {
      const photo = el.querySelector('img')
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } })
      tl.fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut' })
      if (photo) tl.from(photo, { scale: 1.25, duration: 1.8, ease: 'power3.out' }, 0)
    })

    // Menu entries set in, chapter by chapter.
    gsap.utils.toArray<HTMLElement>('.ed-dishes').forEach((list) => {
      gsap.from(list.children, {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.07,
        scrollTrigger: { trigger: list, start: 'top 88%', once: true },
      })
    })
  })

  // Gallery figures drift at different speeds on larger screens.
  mm.add('(min-width: 700px) and (prefers-reduced-motion: no-preference)', () => {
    gsap.utils.toArray<HTMLElement>('[data-speed]').forEach((fig) => {
      const speed = parseFloat(fig.dataset.speed || '0')
      gsap.fromTo(fig, { y: () => speed * 300 }, {
        y: () => -speed * 300,
        ease: 'none',
        scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      })
    })
  })
}
