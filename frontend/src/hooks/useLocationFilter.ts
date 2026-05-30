import { useState } from 'react'

export function useLocationFilter() {
  const [radius, setRadius] = useState(10)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)

  const detect = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
    })
  }

  return { radius, setRadius, coords, detect }
}
