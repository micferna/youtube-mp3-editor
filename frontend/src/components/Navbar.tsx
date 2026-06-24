import { NavLink } from 'react-router-dom'
import { Download, Scissors, Library } from 'lucide-react'
import BrandWave from './BrandWave'

const navItems = [
  { to: '/', label: 'Download', icon: Download },
  { to: '/editor', label: 'Editor', icon: Scissors },
  { to: '/library', label: 'Library', icon: Library },
]

export default function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(250, 250, 248, 0.82)',
        backdropFilter: 'saturate(180%) blur(12px)',
        WebkitBackdropFilter: 'saturate(180%) blur(12px)',
        borderBottom: '1px solid var(--line)',
      }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-6 flex items-center justify-between h-16">
        {/* Wordmark — waveform mark + name */}
        <NavLink to="/" className="flex items-center gap-2.5 group">
          <span
            className="flex items-center h-5 w-6"
            style={{ color: 'var(--iris)' }}
          >
            <BrandWave bars={6} />
          </span>
          <span
            className="text-[17px] font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--ink)' }}
          >
            ytstudio
          </span>
        </NavLink>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className="relative flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-[10px] text-sm font-medium transition-colors duration-150"
              style={({ isActive }) => ({
                color: isActive ? 'var(--iris-600)' : 'var(--muted)',
                background: isActive ? 'var(--iris-tint)' : 'transparent',
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
                  <span className="hidden sm:inline">{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
