'use client'

import React from 'react'
import { Facehash } from 'facehash'

type BrokerAvatarProps = {
  size?: number | string
  name?: string
  className?: string
}

export function BrokerAvatar({
  size = 20,
  name = 'Preflight Broker',
  className = '',
}: BrokerAvatarProps) {
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden border border-zinc-200/80 shadow-2xs ${className}`}
      style={{ width: size, height: size }}
    >
      <Facehash
        name={name}
        size={size}
        variant='gradient'
        intensity3d='subtle'
        interactive={true}
        showInitial={false}
      />
    </div>
  )
}
