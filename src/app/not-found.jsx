import Link from 'next/link'

export default function NotFound() {
  return (
    <>
      <h1 className="page-title">Page not found</h1>
      <p className="lead">
        <Link href="/">← Back to projects</Link>
      </p>
    </>
  )
}
