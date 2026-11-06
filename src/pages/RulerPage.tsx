import { useDocumentTitle } from '../hooks/useDocumentTitle'
import ScreenRuler from '../modes/screen-ruler'

export default function RulerPage() {
  useDocumentTitle('On-screen ruler')
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight">On-screen ruler</h1>
        <p className="text-muted-foreground">Measure small things by laying them on your screen.</p>
      </div>
      <ScreenRuler />
    </div>
  )
}
