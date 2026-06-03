'use client'

import React from 'react'

interface PNPELogoProps {
  theme?: 'light' | 'dark' | 'auto'
  className?: string
}

export function PNPELogo({ theme = 'auto', className = '' }: PNPELogoProps) {
  if (theme === 'light') {
    return (
      <img 
        src="/pnpe-logo.svg" 
        alt="PNPE Logo (Version Bleue)" 
        className={`object-contain max-w-full ${className}`} 
      />
    )
  }
  
  if (theme === 'dark') {
    return (
      <img 
        src="/pnpe-logo-white.svg" 
        alt="PNPE Logo (Version Blanche)" 
        className={`object-contain max-w-full ${className}`} 
      />
    )
  }

  // Auto mode uses CSS rules to show/hide based on container theme/background classes
  return (
    <div className={`relative inline-block ${className}`}>
      {/* Display on light background parent containers */}
      <img 
        src="/pnpe-logo.svg" 
        alt="PNPE Logo (Version Bleue)" 
        className="block dark-bg-hidden object-contain max-h-full max-w-full" 
      />
      {/* Display on dark background parent containers */}
      <img 
        src="/pnpe-logo-white.svg" 
        alt="PNPE Logo (Version Blanche)" 
        className="hidden dark-bg-visible object-contain max-h-full max-w-full" 
      />
    </div>
  )
}
