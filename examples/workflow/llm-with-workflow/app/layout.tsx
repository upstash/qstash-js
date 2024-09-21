import type { Metadata } from 'next'
import { Reddit_Mono } from 'next/font/google'
import cx from 'utils/cx'
import './globals.css'

export const metadata: Metadata = {
  title: 'LLM with Workflow',
  description: 'LLM call with and without Workflow',
  icons: {
    icon: '/favicon-32x32.png',
  },
}

const defaultFont = Reddit_Mono({
  variable: '--font-default',
  display: 'swap',
  style: ['normal'],
  weight: ['400', '700'],
  subsets: ['latin-ext'],
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={cx('scroll-smooth', defaultFont.variable)}>
      <body
        className={cx(
          'bg-gradient-to-b from-white to-emerald-50 text-sm text-zinc-800 antialiased',
          'selection:bg-emerald-200 selection:text-emerald-800',
        )}
      >
        {children}
      </body>
    </html>
  )
}
