import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  icon?: ReactNode
  children: ReactNode
  maxWidth?: string
}

export default function Modal({
  isOpen,
  onClose,
  title,
  icon,
  children,
  maxWidth = 'max-w-md',
}: ModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(22, 23, 29, 0.32)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full ${maxWidth} rounded-[18px] overflow-hidden max-h-[90vh] overflow-y-auto fade-up`}
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--line)' }}
        >
          <div className="flex items-center gap-2.5">
            {icon && <span style={{ color: 'var(--iris)' }}>{icon}</span>}
            <h2 className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--ink)' }}>
              {title}
            </h2>
          </div>
          <button onClick={onClose} className="u-btn u-btn-quiet h-8 w-8 p-0" title="Close">
            <X size={17} />
          </button>
        </div>

        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
