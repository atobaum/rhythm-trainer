import { useState } from 'react'
import './presentation/app.css'
import AreaSwitch from './presentation/components/AreaSwitch.tsx'
import type { AppArea } from './presentation/components/AreaSwitch.tsx'
import { readStored, writeStored } from './presentation/local-store.ts'
import FretboardApp from './presentation/pages/FretboardApp.tsx'
import PracticeApp from './presentation/pages/PracticeApp.tsx'

const AREA_STORAGE_KEY = 'rhythm-lab.area.v1'

function loadArea(): AppArea {
  return readStored<AppArea>(AREA_STORAGE_KEY, 'rhythm') === 'fretboard' ? 'fretboard' : 'rhythm'
}

export default function App() {
  const [area, setArea] = useState(loadArea)
  const changeArea = (next: AppArea) => {
    setArea(next)
    writeStored(AREA_STORAGE_KEY, next)
  }
  const areaSwitch = <AreaSwitch value={area} onChange={changeArea} />
  return area === 'fretboard' ? <FretboardApp areaSwitch={areaSwitch} /> : <PracticeApp areaSwitch={areaSwitch} />
}
