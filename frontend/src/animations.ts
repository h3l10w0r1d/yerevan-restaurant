import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { RefObject } from 'react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Don't re-measure when the mobile address bar slides in and out.
ScrollTrigger.config({ ignoreMobileResize: true })

// Handy for poking at timelines from the console during development.
if (import.meta.env.DEV) Object.assign(window, { gsap, ScrollTrigger })

/**
 * Page-wide scroll choreography. Everything sits behind a reduced-motion
 * media query, so users who opt out get the static page.
 */
export function useScrollAnimations(root: RefObject<HTMLElement | null>) {
  useGSAP(
    () => {
      const mm = gsap.matchMedia()


      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero: draw Ararat, then the wordmark and copy rise in.
        const hero = gsap.timeline({ defaults: { ease: 'power3.out' } })
        hero
          .from('.hero .logo__mountain', { strokeDashoffset: 1, duration: 1.6, ease: 'power2.inOut' })
          .from('.hero .logo__word', { y: 24, opacity: 0, duration: 1 }, 0.5)
          .from('.hero .logo__sub', { y: 12, opacity: 0, duration: 0.8 }, 0.8)
          // fromTo with explicit end values: never read the resting state mid-transition.
          .fromTo('.hero__tagline, .hero__cta > *, .hero__address', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.1 }, 1)

        // The Opera photo drifts slower than the page (transform only).
        gsap.to('.hero__bg img', {
          yPercent: 8,
          ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        })
        gsap.from('.hero__bg img', { scale: 1.08, duration: 2.4, ease: 'power2.out' })

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
      })

      sharedSections(mm)

      // Gallery: pinned horizontal scroll on wide screens, native swipe on phones.
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        const track = document.querySelector<HTMLElement>('.gallery__track')
        if (!track) return
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth)
        // With few photos on a very wide screen there's nothing to scroll sideways.
        if (distance() < 40) return
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
    { scope: root },
  )
}


/** Reservation form fields and visit columns stagger in. */
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
