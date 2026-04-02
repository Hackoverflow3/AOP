import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AOP — Autonomous Office Protocol',
  description: 'Four AI specialists. Four rooms. One complete deliverable.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
