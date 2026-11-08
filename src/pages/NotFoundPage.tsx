import { Link } from 'react-router'
import { NotFoundArt } from '../components/ModeArt'
import { PageHeader } from '../components/layout/PageHeader'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="flex flex-col items-center gap-6 pt-6 text-center">
      <NotFoundArt className="w-48" />
      <PageHeader title="We can’t find that page" className="mb-0 justify-center text-center" />
      <Link to="/" className="inline-flex h-11 items-center justify-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground transition-colors duration-150 hover:bg-primary-hover">
        Go home
      </Link>
    </div>
  )
}
