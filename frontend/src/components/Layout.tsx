import type { ReactNode } from 'react'
import Navbar from './Navbar'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* Faint dotted texture so the airy paper has subtle depth */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(var(--line-strong) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          opacity: 0.4,
          maskImage: 'radial-gradient(ellipse 80% 50% at 50% 0%, #000 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 50% at 50% 0%, #000 40%, transparent 100%)',
        }}
      />
      <div className="relative z-10">
        <Navbar />
        <main className="max-w-6xl mx-auto px-5 sm:px-6 py-10">{children}</main>
      </div>
    </div>
  )
}
