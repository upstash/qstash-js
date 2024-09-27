import type { Metadata } from 'next'
import { Reddit_Mono } from 'next/font/google'
import cx from 'utils/cx'
import './globals.css'
import 'prismjs/themes/prism-tomorrow.css'

export const metadata: Metadata = {
  title: 'Image Generation with Workflow',
  description: 'Optimizing Vercel Functions With Upstash Workflow',
  icons: {
    icon: '/upstash-logo.svg',
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
          'bg-gradient-to-b from-white to-emerald-50 text-sm text-zinc-800 antialiased sm:text-base',
          'selection:bg-emerald-200 selection:text-emerald-800',
        )}
      >
        {children}
      </body>
    </html>
  )
}
