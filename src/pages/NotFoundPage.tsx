import { Link } from 'react-router'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-3xl font-bold tracking-tight">We can’t find that page</h1>
      <p className="text-muted-foreground">The page you opened doesn’t exist.</p>
      <Link to="/" className="font-semibold text-primary underline underline-offset-2">
        Go to the home page
      </Link>
    </div>
  )
}
