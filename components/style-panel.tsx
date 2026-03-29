"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import {
  getElementPropertyFields,
  getElementPropertySections,
  type ElementPropertyField,
  type ElementPropertyMap,
  type ElementPropertySection,
  type ElementPropertyValue,
} from "@/lib/design-element-properties"
import { cn } from "@/lib/utils"
import { validateStyleValue, type ValidationResult } from "@/lib/style-validators"
import { 
  ChevronDown, 
  X, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  Maximize2,
  Move,
  Layers,
  Type,
  Droplet,
  Square,
  Sparkles,
  Link2,
  Image as ImageIcon,
  Undo2,
  Redo2,
  AlertCircle,
  Check
} from "lucide-react"

// ============================================================================
// TYPES
// ============================================================================

export type StyleProperty = string | number

export interface StyleChange {
  id: string
  selector: string
  property: string
  oldValue: string | number
  newValue: string | number
  timestamp: number
}

export interface SelectedElement {
  id: string
  type: string
  styles: Record<string, StyleProperty>
  properties?: ElementPropertyMap
  clickPosition?: { x: number; y: number }
}

interface StylePanelProps {
  selectedElement: SelectedElement
  onStyleChange: (property: string, value: StyleProperty, validated?: boolean) => void
  onLiveStyleChange?: (property: string, value: StyleProperty) => void
  onElementChange: (element: SelectedElement) => void
  onClose: () => void
  className?: string
  initialPosition?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
  onUndo?: () => void
  onRedo?: () => void
  canUndo?: boolean
  canRedo?: boolean
}

interface DropdownOption {
  value: string
  label: string
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

function useSectionState(storageKey: string = 'style-panel-sections') {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(['size'])
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? new Set(JSON.parse(stored)) : new Set(['size'])
    } catch {
      return new Set(['size'])
    }
  })

  const toggleSection = useCallback((sectionName: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionName)) {
        next.delete(sectionName)
      } else {
        next.add(sectionName)
      }
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [storageKey])

  const isExpanded = useCallback((sectionName: string) => {
    return expandedSections.has(sectionName)
  }, [expandedSections])

  const expandSections = useCallback((sectionNames: string[]) => {
    setExpandedSections(() => {
      const next = new Set(sectionNames)
      try {
        localStorage.setItem(storageKey, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }, [storageKey])

  const collapseAllSections = useCallback(() => {
    setExpandedSections(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify([]))
      } catch {}
      return new Set()
    })
  }, [storageKey])

  return { expandedSections, toggleSection, isExpanded, expandSections, collapseAllSections }
}

// Enhanced debounce with immediate option
function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 150
): { debounced: T; immediate: T; cancel: () => void } {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

  // Keep callback ref up to date
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const debounced = useCallback((...args: Parameters<T>) => {
    cancel()
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args)
    }, delay)
  }, [cancel, delay]) as T

  const immediate = useCallback((...args: Parameters<T>) => {
    cancel()
    callbackRef.current(...args)
  }, [cancel]) as T

  return { debounced, immediate, cancel }
}

// ============================================================================
// REFINED SUB-COMPONENTS
// ============================================================================

interface SectionHeaderProps {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
}

function SectionHeader({ title, icon, isExpanded, onToggle }: SectionHeaderProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group w-full flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-stone-800/40"
    >
      <div className={cn(
        "flex items-center justify-center transition-colors duration-200",
        isExpanded 
          ? "text-stone-200" 
          : "text-stone-500 group-hover:text-stone-400"
      )}>
        {icon}
      </div>
      <span className={cn(
        "flex-1 text-left text-[12px] font-medium transition-colors duration-200",
        isExpanded ? "text-stone-200" : "text-stone-400 group-hover:text-stone-300"
      )}>
        {title}
      </span>
      <ChevronDown className={cn(
        "w-3.5 h-3.5 text-stone-500 transition-transform duration-200",
        isExpanded && "rotate-180 text-stone-300"
      )} />
    </button>
  )
}

interface SectionProps {
  name: string
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Section({ name, title, icon, isExpanded, onToggle, children }: SectionProps) {
  return (
    <div className="relative">
      <SectionHeader title={title} icon={icon} isExpanded={isExpanded} onToggle={onToggle} />
      
      <div className={cn(
        "overflow-hidden transition-all duration-400 ease-out",
        isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 pb-4 pt-1 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      </div>
      
      {/* Elegant divider */}
      <div className="mx-4 h-px bg-stone-800/60" />
    </div>
  )
}

interface StyledInputProps {
  label: string
  value: string | number
  onChange: (value: string) => void
  onImmediateChange?: (value: string) => void
  placeholder?: string
  unit?: string
  compact?: boolean
  property?: string // For validation
  showValidation?: boolean
}

function StyledInput({ label, value, onChange, onImmediateChange, placeholder, unit, compact, property, showValidation = true }: StyledInputProps) {
  const [localValue, setLocalValue] = useState(value?.toString() || '')
  const [isFocused, setIsFocused] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalValue(value?.toString() || '')
    // Clear validation when external value changes
    setValidation(null)
  }, [value])

  // Clear feedback timeout on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    
    // Validate if property is provided
    if (property && showValidation && newValue) {
      const result = validateStyleValue(property, newValue)
      setValidation(result)
      
      // Show feedback briefly
      setShowFeedback(true)
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setShowFeedback(false), 2000)
      
      // Only propagate valid values
      if (result.isValid) {
        onChange(result.sanitizedValue.toString())
      }
    } else {
      onChange(newValue)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    // On blur, apply the sanitized value if valid
    if (property && localValue && validation?.isValid && onImmediateChange) {
      onImmediateChange(validation.sanitizedValue.toString())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (onImmediateChange) {
        if (property) {
          if (validation?.isValid) {
            onImmediateChange(validation.sanitizedValue.toString())
          }
        } else {
          onImmediateChange(localValue)
        }
      }
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const getBorderColor = () => {
    if (!showValidation || !validation || !localValue) return ''
    if (!validation.isValid) return 'border-red-500/50'
    if (validation.warning) return 'border-amber-500/50'
    return 'border-emerald-500/30'
  }

  return (
    <div className={cn("flex flex-col gap-1.5", compact && "flex-1")}>
      <label className="text-[11px] font-medium text-stone-400 capitalize">
        {label}
      </label>
      <div className="relative">
        <div className={cn(
          "relative group rounded-md transition-all duration-200 bg-stone-800/40",
          isFocused 
            ? "ring-1 ring-stone-500/50 bg-stone-800"
            : "hover:bg-stone-800/80"
        )}>
          <input
            type="text"
            value={localValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "w-full h-7 px-2.5 text-[12px] font-mono",
              "bg-transparent text-stone-200 placeholder:text-stone-600",
              "border border-transparent rounded-md",
              "focus:outline-none",
              "transition-all duration-200",
              getBorderColor()
            )}
          />
          {unit && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-600">
              {unit}
            </span>
          )}
          
          {/* Validation indicator */}
          {showValidation && validation && localValue && showFeedback && (
            <div className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 transition-opacity duration-200",
              unit && "right-8"
            )}>
              {validation.isValid ? (
                validation.warning ? (
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                )
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
          )}
        </div>
        
        {/* Error/Warning message */}
        {showValidation && validation && showFeedback && (validation.error || validation.warning) && (
          <div className={cn(
            "absolute left-0 right-0 top-full mt-1 px-2 py-1 text-[10px] rounded-md z-10",
            "animate-in fade-in slide-in-from-top-1 duration-200",
            validation.error 
              ? "bg-red-500/10 text-red-400 border border-red-500/20" 
              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          )}>
            {validation.error || validation.warning}
          </div>
        )}
      </div>
    </div>
  )
}

interface ColorInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  onImmediateChange?: (value: string) => void
  property?: string
}

function ColorInput({ label, value, onChange, onImmediateChange, property }: ColorInputProps) {
  const [localValue, setLocalValue] = useState(value || '')
  const [isFocused, setIsFocused] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalValue(value || '')
    setValidation(null)
  }, [value])

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    
    if (property && newValue) {
      const result = validateStyleValue(property, newValue)
      setValidation(result)
      
      setShowFeedback(true)
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setShowFeedback(false), 2000)
      
      if (result.isValid) {
        onChange(result.sanitizedValue.toString())
      }
    } else {
      onChange(newValue)
    }
  }

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange(newValue)
    // Immediate apply for color picker
    if (onImmediateChange) {
      onImmediateChange(newValue)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (onImmediateChange && validation?.isValid) {
      onImmediateChange(validation.sanitizedValue.toString())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (onImmediateChange && validation?.isValid) {
        onImmediateChange(validation.sanitizedValue.toString())
      }
      ;(e.target as HTMLInputElement).blur()
    }
  }

  const displayColor = localValue === 'transparent' ? '#00000000' : localValue || '#000000'

  const getBorderColor = () => {
    if (!validation || !localValue) return 'border-stone-700/50'
    if (!validation.isValid) return 'border-red-500/50'
    if (validation.warning) return 'border-amber-500/50'
    return 'border-stone-700/50'
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-stone-400 capitalize">
        {label}
      </label>
      <div className="relative">
        <div className={cn(
          "flex items-center gap-2 p-1 rounded-md transition-all duration-200",
          "bg-stone-800/40 border",
          getBorderColor(),
          "hover:bg-stone-800/80",
          isFocused && "bg-stone-800 ring-1 ring-stone-500/50"
        )}>
          <div className="relative w-7 h-7 rounded-md overflow-hidden shadow-inner">
            <div 
              className="absolute inset-0"
              style={{ 
                backgroundImage: `linear-gradient(45deg, #27272a 25%, transparent 25%), 
                                 linear-gradient(-45deg, #27272a 25%, transparent 25%), 
                                 linear-gradient(45deg, transparent 75%, #27272a 75%), 
                                 linear-gradient(-45deg, transparent 75%, #27272a 75%)`,
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
              }}
            />
            <input
              type="color"
              value={displayColor.startsWith('#') ? displayColor.slice(0, 7) : '#000000'}
              onChange={handleColorPickerChange}
              className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
            />
            <div 
              className="absolute inset-0 pointer-events-none rounded-md ring-1 ring-inset ring-white/10"
              style={{ backgroundColor: displayColor }}
            />
          </div>
          <input
            type="text"
            value={localValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder="#000000"
            className="flex-1 h-7 px-2 text-xs font-mono text-stone-300 bg-transparent focus:outline-none"
          />
          
          {/* Validation indicator */}
          {validation && localValue && showFeedback && (
            <div className="transition-opacity duration-200">
              {validation.isValid ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              )}
            </div>
          )}
        </div>
        
        {/* Error message */}
        {validation && showFeedback && validation.error && (
          <div className="absolute left-0 right-0 top-full mt-1 px-2 py-1 text-[10px] rounded-md z-10 bg-red-500/10 text-red-400 border border-red-500/20 animate-in fade-in slide-in-from-top-1 duration-200">
            {validation.error}
          </div>
        )}
      </div>
    </div>
  )
}

interface StyledDropdownProps {
  label: string
  value: string
  onChange: (value: string) => void
  options: DropdownOption[]
}

function StyledDropdown({ label, value, onChange, options }: StyledDropdownProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-stone-400 capitalize">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-7 px-2.5 text-[12px] font-mono appearance-none cursor-pointer",
          "bg-stone-800/40 text-stone-200 border border-transparent rounded-md",
          "focus:outline-none focus:ring-1 focus:ring-stone-500/50",
          "hover:bg-stone-800/80 transition-all duration-200",
          "bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2378716c%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')]",
          "bg-no-repeat bg-[right_0.75rem_center]"
        )}
      >
        <option value="" className="bg-stone-900">Select...</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value} className="bg-stone-900">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface StyledSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
  onChangeComplete?: (value: number) => void
  min?: number
  max?: number
  step?: number
  unit?: string
}

function StyledSlider({ label, value, onChange, onChangeComplete, min = 0, max = 100, step = 1, unit = '' }: StyledSliderProps) {
  const controlledValue = typeof value === 'number' ? value : parseFloat(value) || 0
  const [localValue, setLocalValue] = useState(controlledValue)
  const [isDragging, setIsDragging] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)

  useEffect(() => {
    if (!isDragging && !isInputFocused) {
      setLocalValue(controlledValue)
    }
  }, [controlledValue, isDragging, isInputFocused])

  const snapToStep = useCallback((nextValue: number) => {
    const clamped = Math.min(max, Math.max(min, nextValue))
    const stepped = Math.round((clamped - min) / step) * step + min
    const precision = step.toString().includes('.') ? step.toString().split('.')[1]?.length || 0 : 0
    return precision > 0 ? parseFloat(stepped.toFixed(precision)) : stepped
  }, [min, max, step])

  const applyValue = useCallback((nextValue: number, commit = false) => {
    const normalized = snapToStep(nextValue)
    setLocalValue(normalized)
    onChange(normalized)
    if (commit && onChangeComplete) {
      onChangeComplete(normalized)
    }
  }, [onChange, onChangeComplete, snapToStep])

  const percentage = max === min ? 0 : ((localValue - min) / (max - min)) * 100

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    applyValue(newValue)
  }

  const handleCommit = () => {
    if (isDragging && onChangeComplete) {
      onChangeComplete(snapToStep(localValue))
    }
    setIsDragging(false)
  }

  const handleNumberInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value === '') return
    const parsed = parseFloat(e.target.value)
    if (Number.isFinite(parsed)) {
      applyValue(parsed)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-stone-400 capitalize">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={localValue}
            min={min}
            max={max}
            step={step}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => {
              setIsInputFocused(false)
              applyValue(localValue, true)
            }}
            onChange={handleNumberInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                applyValue(localValue, true)
                ;(e.target as HTMLInputElement).blur()
              }
            }}
            className="h-6 w-14 rounded-md border border-transparent bg-stone-800/40 px-1.5 text-right text-[11px] font-mono text-stone-200 outline-none transition-all focus:bg-stone-800 focus:ring-1 focus:ring-stone-500/50 hover:bg-stone-800/80"
          />
          {!!unit && (
            <span className={cn(
              "text-[10px] font-bold uppercase transition-colors duration-200",
              isDragging ? "text-amber-300" : "text-amber-400/80"
            )}>
              {unit}
            </span>
          )}
        </div>
      </div>
      <div className="relative h-2 rounded-full bg-stone-800 overflow-hidden">
        <div 
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all",
            isDragging ? "bg-stone-300 duration-75" : "bg-stone-400/80 duration-150"
          )}
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          value={localValue}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={handleCommit}
          onMouseLeave={handleCommit}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={handleCommit}
          min={min}
          max={max}
          step={step}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
    </div>
  )
}

interface ValuePresetRowProps {
  label: string
  values: number[]
  unit?: string
  onSelect: (value: number) => void
}

function ValuePresetRow({ label, values, unit = '', onSelect }: ValuePresetRowProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-stone-400 capitalize">{label}</p>
      <div className="grid grid-cols-6 gap-1.5">
        {values.map((preset) => (
          <button
            type="button"
            key={`${label}-${preset}`}
            onClick={() => onSelect(preset)}
            className="h-6 rounded-md border border-transparent bg-stone-800/40 px-2 text-[11px] font-mono text-stone-300 transition-all hover:bg-stone-800/80 hover:text-stone-100 focus:ring-1 focus:ring-stone-500/50"
          >
            {preset}{unit}
          </button>
        ))}
      </div>
    </div>
  )
}

interface StyledTextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

function StyledTextArea({ label, value, onChange, placeholder, rows = 2 }: StyledTextAreaProps) {
  const [localValue, setLocalValue] = useState(value || '')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalValue(e.target.value)
    onChange(e.target.value)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-stone-400 capitalize">
        {label}
      </label>
      <textarea
        value={localValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "w-full px-2.5 py-2 text-[12px] font-mono resize-none",
          "bg-stone-800/40 text-stone-200 placeholder:text-stone-600",
          "border border-transparent rounded-md",
          "focus:outline-none focus:bg-stone-800 focus:ring-1 focus:ring-stone-500/50",
          "transition-all duration-200 hover:bg-stone-800/80"
        )}
      />
    </div>
  )
}

interface StyledToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function StyledToggle({ label, checked, onChange }: StyledToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-stone-800/70 bg-stone-900/60 px-3 py-2">
      <label className="text-[11px] font-medium text-stone-300 capitalize">
        {label}
      </label>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 rounded-full border transition-all duration-200",
          checked
            ? "border-stone-500 bg-stone-200"
            : "border-stone-700 bg-stone-800/80 hover:bg-stone-700/80"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200",
            checked ? "left-[22px] bg-stone-950" : "left-0.5 bg-stone-300"
          )}
        />
      </button>
    </div>
  )
}

interface AlignmentButtonsProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function AlignmentButtons({ label, value, onChange }: AlignmentButtonsProps) {
  const options = [
    { value: 'left', icon: <AlignLeft className="w-4 h-4" /> },
    { value: 'center', icon: <AlignCenter className="w-4 h-4" /> },
    { value: 'right', icon: <AlignRight className="w-4 h-4" /> },
    { value: 'justify', icon: <AlignJustify className="w-4 h-4" /> },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-stone-400 capitalize">
        {label}
      </label>
      <div className="flex gap-1 p-1 bg-stone-800/40 rounded-md">
        {options.map(opt => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 flex items-center justify-center py-2 rounded-md transition-all duration-200",
              value === opt.value 
                ? "bg-stone-700/50 text-stone-200 shadow-sm" 
                : "text-stone-500 hover:text-stone-300 hover:bg-stone-700/30"
            )}
          >
            {opt.icon}
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// DROPDOWN OPTIONS
// ============================================================================

const FONT_FAMILY_OPTIONS: DropdownOption[] = [
  { value: 'inherit', label: 'Inherit' },
  { value: '"DM Sans", sans-serif', label: 'DM Sans' },
  { value: '"Playfair Display", serif', label: 'Playfair' },
  { value: '"JetBrains Mono", monospace', label: 'JetBrains' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'system-ui', label: 'System UI' },
]

const DISPLAY_OPTIONS: DropdownOption[] = [
  { value: 'block', label: 'Block' },
  { value: 'inline', label: 'Inline' },
  { value: 'inline-block', label: 'Inline Block' },
  { value: 'flex', label: 'Flex' },
  { value: 'grid', label: 'Grid' },
  { value: 'none', label: 'None' },
]

const POSITION_OPTIONS: DropdownOption[] = [
  { value: 'static', label: 'Static' },
  { value: 'relative', label: 'Relative' },
  { value: 'absolute', label: 'Absolute' },
  { value: 'fixed', label: 'Fixed' },
  { value: 'sticky', label: 'Sticky' },
]

const FLEX_DIRECTION_OPTIONS: DropdownOption[] = [
  { value: 'row', label: 'Row' },
  { value: 'row-reverse', label: 'Row Reverse' },
  { value: 'column', label: 'Column' },
  { value: 'column-reverse', label: 'Column Reverse' },
]

const JUSTIFY_OPTIONS: DropdownOption[] = [
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
  { value: 'space-between', label: 'Space Between' },
  { value: 'space-around', label: 'Space Around' },
]

const ALIGN_OPTIONS: DropdownOption[] = [
  { value: 'stretch', label: 'Stretch' },
  { value: 'flex-start', label: 'Start' },
  { value: 'center', label: 'Center' },
  { value: 'flex-end', label: 'End' },
]

const OVERFLOW_OPTIONS: DropdownOption[] = [
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'scroll', label: 'Scroll' },
  { value: 'auto', label: 'Auto' },
]

const STYLE_SECTION_ORDER = ['size', 'spacing', 'layout', 'typography', 'colors', 'border', 'effects']

const PROPERTY_SECTION_ORDER: ElementPropertySection[] = ['attributes', 'link', 'image', 'button', 'field', 'media', 'list']

const PROPERTY_SECTION_TITLES: Record<ElementPropertySection, string> = {
  attributes: 'Attributes',
  link: 'Link',
  image: 'Image',
  button: 'Button',
  field: 'Form Field',
  media: 'Media',
  list: 'List',
}

// ============================================================================
// SECTION ICONS MAPPING
// ============================================================================

const SECTION_ICONS: Record<string, React.ReactNode> = {
  size: <Maximize2 className="w-4 h-4" />,
  spacing: <Move className="w-4 h-4" />,
  layout: <Layers className="w-4 h-4" />,
  typography: <Type className="w-4 h-4" />,
  colors: <Droplet className="w-4 h-4" />,
  border: <Square className="w-4 h-4" />,
  effects: <Sparkles className="w-4 h-4" />,
  attributes: <span className="font-mono text-xs font-bold">#</span>,
  link: <Link2 className="w-4 h-4" />,
  image: <ImageIcon className="w-4 h-4" />,
  button: <span className="font-mono text-[10px] font-bold uppercase">btn</span>,
  field: <span className="font-mono text-xs font-bold">f(x)</span>,
  media: <span className="font-mono text-xs font-bold">▶</span>,
  list: <span className="font-mono text-xs font-bold">1.</span>,
}

function extractNumericValue(value: StyleProperty | undefined, fallback = 0) {
  if (typeof value === 'number') return value
  if (!value) return fallback
  const parsed = parseFloat(value.toString())
  return Number.isFinite(parsed) ? parsed : fallback
}

function toCssLength(value: number, unit: string = 'px') {
  const normalized = Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d*[1-9])0+$/, '$1')
  return `${normalized}${unit}`
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StylePanel({
  selectedElement,
  onStyleChange,
  onLiveStyleChange,
  onElementChange,
  onClose,
  className,
  initialPosition,
  onPositionChange,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: StylePanelProps) {
  const { toggleSection, isExpanded, expandSections, collapseAllSections } = useSectionState()
  const [position, setPosition] = useState(initialPosition || { x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  
  // Debounced handlers for different update frequencies
  const { debounced: debouncedStyleChange, immediate: immediateStyleChange } = useDebounce(onStyleChange, 100)
  const elementChangeHandlers = useDebounce(onElementChange, 200)

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          onRedo?.()
        } else {
          onUndo?.()
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault()
        onRedo?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onUndo, onRedo])

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }, [position])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      const newPos = {
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      }
      setPosition(newPos)
      onPositionChange?.(newPos)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, onPositionChange])

  // Style change handler with debouncing
  const handleStyleChange = useCallback((property: string, value: StyleProperty) => {
    if (onLiveStyleChange) {
      onLiveStyleChange(property, value)
    }
    debouncedStyleChange(property, value, true)
  }, [onLiveStyleChange, debouncedStyleChange])

  // Immediate style change (for sliders on mouse up, etc.)
  const handleImmediateStyleChange = useCallback((property: string, value: StyleProperty) => {
    if (onLiveStyleChange) {
      onLiveStyleChange(property, value)
    }
    immediateStyleChange(property, value, true)
  }, [onLiveStyleChange, immediateStyleChange])

  const handleElementPropertyChange = useCallback((key: string, value: ElementPropertyValue, immediate: boolean = false) => {
    const nextElement: SelectedElement = {
      ...selectedElement,
      properties: {
        ...selectedElement.properties,
        [key]: value,
      },
    }

    if (immediate) {
      elementChangeHandlers.immediate(nextElement)
      return
    }

    elementChangeHandlers.debounced(nextElement)
  }, [selectedElement, elementChangeHandlers])

  const handlePropertyChange = useCallback((key: string, value: string) => {
    handleElementPropertyChange(key, value)
  }, [handleElementPropertyChange])

  const handleBooleanPropertyChange = useCallback((key: string, value: boolean) => {
    handleElementPropertyChange(key, value, true)
  }, [handleElementPropertyChange])

  const elementTagName = useMemo(() => selectedElement.type.toLowerCase(), [selectedElement.type])

  const applyBoxSpacingPreset = useCallback((propertyPrefix: 'margin' | 'padding', rawValue: number) => {
    const value = toCssLength(rawValue)
    const properties = [`${propertyPrefix}Top`, `${propertyPrefix}Right`, `${propertyPrefix}Bottom`, `${propertyPrefix}Left`]
    properties.forEach((property) => {
      handleImmediateStyleChange(property, value)
    })
  }, [handleImmediateStyleChange])

  const visibleSections = useMemo(() => {
    return [...STYLE_SECTION_ORDER, ...getElementPropertySections(elementTagName)]
  }, [elementTagName])

  const propertySections = useMemo(() => {
    return PROPERTY_SECTION_ORDER.reduce<Record<ElementPropertySection, ElementPropertyField[]>>((sections, section) => {
      sections[section] = getElementPropertyFields(elementTagName, section)
      return sections
    }, {
      attributes: [],
      link: [],
      image: [],
      button: [],
      field: [],
      media: [],
      list: [],
    })
  }, [elementTagName])

  const renderPropertyField = useCallback((field: ElementPropertyField) => {
    const rawValue = selectedElement.properties?.[field.key]

    if (field.control === 'boolean') {
      const checked = rawValue === true || rawValue === 'true'
      return (
        <StyledToggle
          key={`${field.section}-${field.key}`}
          label={field.label}
          checked={checked}
          onChange={(value) => handleBooleanPropertyChange(field.key, value)}
        />
      )
    }

    if (field.control === 'dropdown') {
      return (
        <StyledDropdown
          key={`${field.section}-${field.key}`}
          label={field.label}
          value={rawValue?.toString() || ''}
          onChange={(value) => handleElementPropertyChange(field.key, value, true)}
          options={field.options || []}
        />
      )
    }

    return (
      <StyledInput
        key={`${field.section}-${field.key}`}
        label={field.label}
        value={rawValue?.toString() || ''}
        onChange={(value) => handlePropertyChange(field.key, value)}
        placeholder={field.placeholder}
        showValidation={false}
      />
    )
  }, [handleBooleanPropertyChange, handleElementPropertyChange, handlePropertyChange, selectedElement.properties])

  return (
    <div
      ref={panelRef}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      className={cn(
        "w-80 max-h-[540px] rounded-xl flex flex-col overflow-hidden",
        "bg-stone-950/95 backdrop-blur-xl",
        "border border-stone-800 shadow-2xl shadow-black/60",
        "animate-in fade-in slide-in-from-right-4 duration-300",
        isDragging && "cursor-grabbing select-none",
        className
      )}
    >
      {/* Compact Draggable Header */}
      <div 
        onMouseDown={handleMouseDown}
        className={cn(
          "relative px-4 py-3 border-b border-stone-800/60",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-stone-500" />
            </div>
            <span className="text-xs font-semibold text-stone-300 tracking-wide">
              {selectedElement.type}
            </span>
            <span className="text-[10px] text-stone-500 font-medium">drag to move</span>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Undo/Redo buttons */}
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                canUndo 
                  ? "text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 active:scale-95" 
                  : "text-stone-700 cursor-not-allowed"
              )}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                canRedo 
                  ? "text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 active:scale-95" 
                  : "text-stone-700 cursor-not-allowed"
              )}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            
            <div className="w-px h-4 bg-stone-700/50 mx-1" />
            
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                "text-stone-400 hover:text-stone-200",
                "hover:bg-stone-800/40 active:scale-95"
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="relative mt-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => expandSections(visibleSections)}
            className="h-6 rounded-md bg-stone-800/40 px-2.5 text-[10px] font-medium text-stone-400 transition-colors hover:bg-stone-800/80 hover:text-stone-200"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAllSections}
            className="h-6 rounded-md bg-stone-800/40 px-2.5 text-[10px] font-medium text-stone-400 transition-colors hover:bg-stone-800/80 hover:text-stone-200"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent">
        {/* Size Section */}
        {visibleSections.includes('size') && (
          <Section
            name="size"
            title="Dimensions"
            icon={SECTION_ICONS.size}
            isExpanded={isExpanded('size')}
            onToggle={() => toggleSection('size')}
          >
            <div className="grid grid-cols-2 gap-3">
              <StyledInput
                label="Width"
                value={selectedElement.styles.width?.toString() || ''}
                onChange={(v) => handleStyleChange('width', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('width', v)}
                placeholder="auto"
                property="width"
              />
              <StyledInput
                label="Height"
                value={selectedElement.styles.height?.toString() || ''}
                onChange={(v) => handleStyleChange('height', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('height', v)}
                placeholder="auto"
                property="height"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StyledInput
                label="Min Width"
                value={selectedElement.styles.minWidth?.toString() || ''}
                onChange={(v) => handleStyleChange('minWidth', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('minWidth', v)}
                placeholder="none"
                property="minWidth"
              />
              <StyledInput
                label="Max Width"
                value={selectedElement.styles.maxWidth?.toString() || ''}
                onChange={(v) => handleStyleChange('maxWidth', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('maxWidth', v)}
                placeholder="none"
                property="maxWidth"
              />
            </div>
          </Section>
        )}

        {/* Spacing Section */}
        {visibleSections.includes('spacing') && (
          <Section
            name="spacing"
            title="Spacing"
            icon={SECTION_ICONS.spacing}
            isExpanded={isExpanded('spacing')}
            onToggle={() => toggleSection('spacing')}
          >
            <ValuePresetRow
              label="Margin Presets"
              values={[0, 4, 8, 12, 16, 24]}
              unit="px"
              onSelect={(value) => applyBoxSpacingPreset('margin', value)}
            />
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-stone-400 capitalize">Margin</p>
              <div className="grid grid-cols-4 gap-2">
                <StyledInput label="Top" value={selectedElement.styles.marginTop?.toString() || ''} onChange={(v) => handleStyleChange('marginTop', v)} onImmediateChange={(v) => handleImmediateStyleChange('marginTop', v)} property="marginTop" compact />
                <StyledInput label="Right" value={selectedElement.styles.marginRight?.toString() || ''} onChange={(v) => handleStyleChange('marginRight', v)} onImmediateChange={(v) => handleImmediateStyleChange('marginRight', v)} property="marginRight" compact />
                <StyledInput label="Bottom" value={selectedElement.styles.marginBottom?.toString() || ''} onChange={(v) => handleStyleChange('marginBottom', v)} onImmediateChange={(v) => handleImmediateStyleChange('marginBottom', v)} property="marginBottom" compact />
                <StyledInput label="Left" value={selectedElement.styles.marginLeft?.toString() || ''} onChange={(v) => handleStyleChange('marginLeft', v)} onImmediateChange={(v) => handleImmediateStyleChange('marginLeft', v)} property="marginLeft" compact />
              </div>
            </div>
            <ValuePresetRow
              label="Padding Presets"
              values={[0, 4, 8, 12, 16, 24]}
              unit="px"
              onSelect={(value) => applyBoxSpacingPreset('padding', value)}
            />
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-stone-400 capitalize">Padding</p>
              <div className="grid grid-cols-4 gap-2">
                <StyledInput label="Top" value={selectedElement.styles.paddingTop?.toString() || ''} onChange={(v) => handleStyleChange('paddingTop', v)} onImmediateChange={(v) => handleImmediateStyleChange('paddingTop', v)} property="paddingTop" compact />
                <StyledInput label="Right" value={selectedElement.styles.paddingRight?.toString() || ''} onChange={(v) => handleStyleChange('paddingRight', v)} onImmediateChange={(v) => handleImmediateStyleChange('paddingRight', v)} property="paddingRight" compact />
                <StyledInput label="Bottom" value={selectedElement.styles.paddingBottom?.toString() || ''} onChange={(v) => handleStyleChange('paddingBottom', v)} onImmediateChange={(v) => handleImmediateStyleChange('paddingBottom', v)} property="paddingBottom" compact />
                <StyledInput label="Left" value={selectedElement.styles.paddingLeft?.toString() || ''} onChange={(v) => handleStyleChange('paddingLeft', v)} onImmediateChange={(v) => handleImmediateStyleChange('paddingLeft', v)} property="paddingLeft" compact />
              </div>
            </div>
          </Section>
        )}

        {/* Layout Section */}
        {visibleSections.includes('layout') && (
          <Section
            name="layout"
            title="Layout"
            icon={SECTION_ICONS.layout}
            isExpanded={isExpanded('layout')}
            onToggle={() => toggleSection('layout')}
          >
            <div className="grid grid-cols-2 gap-3">
              <StyledDropdown
                label="Display"
                value={selectedElement.styles.display?.toString() || ''}
                onChange={(v) => handleImmediateStyleChange('display', v)}
                options={DISPLAY_OPTIONS}
              />
              <StyledDropdown
                label="Position"
                value={selectedElement.styles.position?.toString() || ''}
                onChange={(v) => handleImmediateStyleChange('position', v)}
                options={POSITION_OPTIONS}
              />
            </div>
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-stone-400 capitalize">Offsets</p>
              <div className="grid grid-cols-4 gap-2">
                <StyledInput label="Top" value={selectedElement.styles.top?.toString() || ''} onChange={(v) => handleStyleChange('top', v)} onImmediateChange={(v) => handleImmediateStyleChange('top', v)} property="top" compact />
                <StyledInput label="Right" value={selectedElement.styles.right?.toString() || ''} onChange={(v) => handleStyleChange('right', v)} onImmediateChange={(v) => handleImmediateStyleChange('right', v)} property="right" compact />
                <StyledInput label="Bottom" value={selectedElement.styles.bottom?.toString() || ''} onChange={(v) => handleStyleChange('bottom', v)} onImmediateChange={(v) => handleImmediateStyleChange('bottom', v)} property="bottom" compact />
                <StyledInput label="Left" value={selectedElement.styles.left?.toString() || ''} onChange={(v) => handleStyleChange('left', v)} onImmediateChange={(v) => handleImmediateStyleChange('left', v)} property="left" compact />
              </div>
            </div>
            <StyledDropdown
              label="Flex Direction"
              value={selectedElement.styles.flexDirection?.toString() || ''}
              onChange={(v) => handleImmediateStyleChange('flexDirection', v)}
              options={FLEX_DIRECTION_OPTIONS}
            />
            <div className="grid grid-cols-2 gap-3">
              <StyledDropdown
                label="Justify"
                value={selectedElement.styles.justifyContent?.toString() || ''}
                onChange={(v) => handleImmediateStyleChange('justifyContent', v)}
                options={JUSTIFY_OPTIONS}
              />
              <StyledDropdown
                label="Align"
                value={selectedElement.styles.alignItems?.toString() || ''}
                onChange={(v) => handleImmediateStyleChange('alignItems', v)}
                options={ALIGN_OPTIONS}
              />
            </div>
            <StyledInput
              label="Gap"
              value={selectedElement.styles.gap?.toString() || ''}
              onChange={(v) => handleStyleChange('gap', v)}
              onImmediateChange={(v) => handleImmediateStyleChange('gap', v)}
              placeholder="0"
              property="gap"
            />
            <StyledSlider
              label="Gap Slider"
              value={extractNumericValue(selectedElement.styles.gap, 0)}
              onChange={(value) => handleStyleChange('gap', toCssLength(value))}
              onChangeComplete={(value) => handleImmediateStyleChange('gap', toCssLength(value))}
              min={0}
              max={120}
              step={1}
              unit="px"
            />
          </Section>
        )}

        {/* Typography Section */}
        {visibleSections.includes('typography') && (
          <Section
            name="typography"
            title="Typography"
            icon={SECTION_ICONS.typography}
            isExpanded={isExpanded('typography')}
            onToggle={() => toggleSection('typography')}
          >
            <StyledDropdown
              label="Font Family"
              value={selectedElement.styles.fontFamily?.toString() || ''}
              onChange={(v) => handleStyleChange('fontFamily', v)}
              options={FONT_FAMILY_OPTIONS}
            />
            <StyledSlider
              label="Font Size"
              value={extractNumericValue(selectedElement.styles.fontSize, 16)}
              onChange={(value) => handleStyleChange('fontSize', toCssLength(value))}
              onChangeComplete={(value) => handleImmediateStyleChange('fontSize', toCssLength(value))}
              min={8}
              max={96}
              step={1}
              unit="px"
            />
            <div className="grid grid-cols-2 gap-3">
              <StyledInput
                label="Weight"
                value={selectedElement.styles.fontWeight?.toString() || ''}
                onChange={(v) => handleStyleChange('fontWeight', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('fontWeight', v)}
                placeholder="400"
                property="fontWeight"
              />
              <StyledInput
                label="Size"
                value={selectedElement.styles.fontSize?.toString() || ''}
                onChange={(v) => handleStyleChange('fontSize', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('fontSize', v)}
                placeholder="16px"
                property="fontSize"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StyledInput
                label="Line Height"
                value={selectedElement.styles.lineHeight?.toString() || ''}
                onChange={(v) => handleStyleChange('lineHeight', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('lineHeight', v)}
                placeholder="1.5"
                property="lineHeight"
              />
              <StyledInput
                label="Letter Spacing"
                value={selectedElement.styles.letterSpacing?.toString() || ''}
                onChange={(v) => handleStyleChange('letterSpacing', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('letterSpacing', v)}
                placeholder="normal"
                property="letterSpacing"
              />
            </div>
            <StyledSlider
              label="Letter Spacing"
              value={extractNumericValue(selectedElement.styles.letterSpacing, 0)}
              onChange={(value) => handleStyleChange('letterSpacing', toCssLength(value))}
              onChangeComplete={(value) => handleImmediateStyleChange('letterSpacing', toCssLength(value))}
              min={-4}
              max={24}
              step={0.5}
              unit="px"
            />
            <AlignmentButtons
              label="Text Align"
              value={selectedElement.styles.textAlign?.toString() || ''}
              onChange={(v) => handleImmediateStyleChange('textAlign', v)}
            />
          </Section>
        )}

        {/* Colors Section */}
        {visibleSections.includes('colors') && (
          <Section
            name="colors"
            title="Colors"
            icon={SECTION_ICONS.colors}
            isExpanded={isExpanded('colors')}
            onToggle={() => toggleSection('colors')}
          >
            <ColorInput
              label="Text Color"
              value={selectedElement.styles.color?.toString() || ''}
              onChange={(v) => handleStyleChange('color', v)}
              onImmediateChange={(v) => handleImmediateStyleChange('color', v)}
              property="color"
            />
            <ColorInput
              label="Background"
              value={selectedElement.styles.backgroundColor?.toString() || ''}
              onChange={(v) => handleStyleChange('backgroundColor', v)}
              onImmediateChange={(v) => handleImmediateStyleChange('backgroundColor', v)}
              property="backgroundColor"
            />
          </Section>
        )}

        {/* Border Section */}
        {visibleSections.includes('border') && (
          <Section
            name="border"
            title="Border"
            icon={SECTION_ICONS.border}
            isExpanded={isExpanded('border')}
            onToggle={() => toggleSection('border')}
          >
            <StyledSlider
              label="Border Width"
              value={extractNumericValue(selectedElement.styles.borderWidth, 0)}
              onChange={(value) => handleStyleChange('borderWidth', toCssLength(value))}
              onChangeComplete={(value) => handleImmediateStyleChange('borderWidth', toCssLength(value))}
              min={0}
              max={20}
              step={1}
              unit="px"
            />
            <StyledSlider
              label="Border Radius"
              value={extractNumericValue(selectedElement.styles.borderRadius, 0)}
              onChange={(value) => handleStyleChange('borderRadius', toCssLength(value))}
              onChangeComplete={(value) => handleImmediateStyleChange('borderRadius', toCssLength(value))}
              min={0}
              max={64}
              step={1}
              unit="px"
            />
            <ValuePresetRow
              label="Radius Presets"
              values={[0, 4, 8, 12, 16, 24]}
              unit="px"
              onSelect={(value) => handleImmediateStyleChange('borderRadius', toCssLength(value))}
            />
            <ColorInput
              label="Border Color"
              value={selectedElement.styles.borderColor?.toString() || ''}
              onChange={(v) => handleStyleChange('borderColor', v)}
              onImmediateChange={(v) => handleImmediateStyleChange('borderColor', v)}
              property="borderColor"
            />
          </Section>
        )}

        {/* Effects Section */}
        {visibleSections.includes('effects') && (
          <Section
            name="effects"
            title="Effects"
            icon={SECTION_ICONS.effects}
            isExpanded={isExpanded('effects')}
            onToggle={() => toggleSection('effects')}
          >
            <StyledSlider
              label="Opacity"
              value={parseFloat(selectedElement.styles.opacity?.toString() || '1') * 100}
              onChange={(v) => handleStyleChange('opacity', (v / 100).toString())}
              onChangeComplete={(v) => handleImmediateStyleChange('opacity', (v / 100).toString())}
              min={0}
              max={100}
              unit="%"
            />
            <StyledDropdown
              label="Overflow"
              value={selectedElement.styles.overflow?.toString() || ''}
              onChange={(v) => handleImmediateStyleChange('overflow', v)}
              options={OVERFLOW_OPTIONS}
            />
            <StyledTextArea
              label="Box Shadow"
              value={selectedElement.styles.boxShadow?.toString() || ''}
              onChange={(v) => handleStyleChange('boxShadow', v)}
              placeholder="0 4px 12px rgba(0,0,0,0.3)"
            />
          </Section>
        )}

        {PROPERTY_SECTION_ORDER.map((section) => {
          const fields = propertySections[section]

          if (!visibleSections.includes(section) || fields.length === 0) {
            return null
          }

          return (
            <Section
              key={section}
              name={section}
              title={PROPERTY_SECTION_TITLES[section]}
              icon={SECTION_ICONS[section]}
              isExpanded={isExpanded(section)}
              onToggle={() => toggleSection(section)}
            >
              {fields.map(renderPropertyField)}
            </Section>
          )
        })}
        
        {/* Bottom padding for scroll */}
        <div className="h-4" />
      </div>
    </div>
  )
}
