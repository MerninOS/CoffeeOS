import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono, Inter, Martian_Mono, Instrument_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

/* ── Instrument design system fonts (operator surfaces) ──────────────────────
   `axes: ['wdth']` is REQUIRED and omitting it fails SILENTLY. Without it,
   Google serves a different .woff2 whose font-stretch is 100% instead of
   75% 112.5%; the font still loads and renders, but every
   font-variation-settings:'wdth' in the design system becomes inert and the
   whole type hierarchy flattens to one width.

   `weight` must stay omitted. Setting it throws "Axes can only be defined for
   variable fonts when the weight property is nonexistent or set to `variable`"
   — and the tempting fix for THAT error is deleting `axes`, which lands you
   right back in the silent failure above.

   Verified by: [...document.fonts].find(f => f.family.includes('Martian')).stretch
   === '75% 112.5%'  (tests/e2e/criteria.spec.ts). */
const martianMono = Martian_Mono({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-martian-mono',
})

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-instrument-sans',
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// Inter as the Cal Sans stand-in — clean, modern, legible
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-inter',
  display: 'swap',
});

// Geist kept for dashboard data/code displays
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: 'CoffeeOS - Streamline your D2C coffee business',
  description: 'CoffeeOS — real-time COGS, inventory, and margin software built for D2C coffee roasters.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png',  media: '(prefers-color-scheme: dark)'  },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {process.env.SHOPIFY_CLIENT_ID && (
          <meta name="shopify-api-key" content={process.env.SHOPIFY_CLIENT_ID} />
        )}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
      </head>
      <body
        className={`${geist.variable} ${geistMono.variable} ${inter.variable} ${martianMono.variable} ${instrumentSans.variable} font-sans antialiased`}
        /* next/font emits a HASHED family name, so the design system's literal
           'Martian Mono' can never match the self-hosted @font-face. Its token
           CSS therefore reads --font-mono: var(--instrument-mono, 'Martian Mono', …);
           these three bindings are what make that indirection resolve. Without
           them the instrument type silently falls back to ui-monospace. */
        style={{
          '--instrument-mono': 'var(--font-martian-mono)',
          '--instrument-display': 'var(--font-martian-mono)',
          '--instrument-sans': 'var(--font-instrument-sans)',
        } as React.CSSProperties}
      >
        {children}
        <Analytics />
      </body>
    </html>
  )
}
