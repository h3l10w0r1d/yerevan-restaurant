import { useRef } from 'react'
import { useScrollAnimations } from '../animations'
import { Gallery } from '../components/Gallery'
import { Hero } from '../components/Hero'
import { Intro } from '../components/Intro'
import { MenuPreview } from '../components/MenuPreview'
import { Order } from '../components/Order'
import { Reservation } from '../components/Reservation'
import { Visit } from '../components/Visit'

export function Home() {
  const mainRef = useRef<HTMLElement>(null)
  useScrollAnimations(mainRef)
  return (
    <main ref={mainRef}>
      <Hero />
      <Intro />
      <MenuPreview />
      <Gallery />
      <Reservation />
      <Order />
      <Visit />
    </main>
  )
}
