import { PageHeader } from '../components/layout/PageHeader'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import ScreenRuler from '../modes/screen-ruler'

export default function RulerPage() {
  useDocumentTitle('On-screen ruler')
  return (
    <>
      <PageHeader back="/" title="On-screen ruler" />
      <ScreenRuler />
    </>
  )
}
