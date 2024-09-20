import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import cx from 'utils/cx'
import './globals.css'

export const metadata: Metadata = {
  title: 'LLM with Workflow',
  description: 'LLM call with and without Workflow',
  icons: {
    icon: '/favicon-32x32.png',
  },
}

const defaultFont = Inter({
  variable: '--font-inter',
  display: 'swap',
  style: 'normal',
  subsets: ['latin-ext'],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cx('scroll-smooth', defaultFont.variable)}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
