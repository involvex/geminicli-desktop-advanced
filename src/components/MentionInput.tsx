import React, { useState, useRef } from 'react'
import { Input } from './ui/input'
import { cn } from '@/lib/utils'

interface MentionInputProps {
  value: string
  onChange: (event: any, newValue: string, newPlainTextValue: string, mentions: any[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  onKeyDown?: (event: React.KeyboardEvent) => void
}

export function MentionInput({
  value,
  onChange,
  placeholder = "Type your message...",
  disabled = false,
  className,
  onKeyDown
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false) // Disabled - was always showing for demo
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e, e.target.value, e.target.value, [])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => prev === 0 ? 1 : 0)
        return
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => prev === 1 ? 0 : 1)
        return
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const file = selectedIndex === 0 ? 'README.md' : 'src-tauri\\src\\read_file.rs'
        const newValue = value + '@' + file + ' '
        onChange(null, newValue, newValue, [])
        return
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowSuggestions(false)
        return
      }
    }
    
    onKeyDown?.(e)
  }

  return (
    <div className={cn("relative", className)}>
      {/* Hard-coded floating dropdown matching screenshot exactly */}
      {showSuggestions && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-2">
          <div
            className={cn(
              "px-3 py-3 cursor-pointer text-sm",
              selectedIndex === 0 
                ? "bg-blue-100 text-blue-600" 
                : "hover:bg-gray-100"
            )}
            onClick={() => {
              const newValue = value + '@README.md '
              onChange(null, newValue, newValue, [])
            }}
          >
            README.md
          </div>
          <div
            className={cn(
              "px-3 py-3 cursor-pointer text-sm",
              selectedIndex === 1 
                ? "bg-blue-100 text-blue-600" 
                : "hover:bg-gray-100"
            )}
            onClick={() => {
              const newValue = value + '@src-tauri\\src\\read_file.rs '
              onChange(null, newValue, newValue, [])
            }}
          >
            src-tauri\src\read_file.rs
          </div>
        </div>
      )}
      
      {/* shadcn Input component */}
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}