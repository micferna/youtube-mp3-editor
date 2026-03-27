import { NavLink } from 'react-router-dom'
import { Download, Scissors, Library } from 'lucide-react'

const navItems = [
  { to: '/', label: 'Download', icon: Download },
  { to: '/editor', label: 'Editor', icon: Scissors },
  { to: '/library', label: 'Library', icon: Library },
]

export default function Navbar() {
  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/5"
      style={{
        background: 'linear-gradient(135deg, rgba(22, 33, 62, 0.95), rgba(26, 26, 46, 0.95))',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span
            className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent"
            style={{
              backgroundImage: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
            }}
          >
            YT Studio
          </span>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'text-[var(--accent-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} />
                  <span>{label}</span>
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full"
                      style={{ background: 'var(--accent-primary)' }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  )
}
