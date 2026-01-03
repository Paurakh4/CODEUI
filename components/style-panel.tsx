"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
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
  properties?: {
    id?: string
    className?: string
    textContent?: string
    href?: string
    src?: string
    alt?: string
    [key: string]: string | undefined
  }
  clickPosition?: { x: number; y: number }
}

interface StylePanelProps {
  selectedElement: SelectedElement
  onStyleChange: (property: string, value: StyleProperty, validated?: boolean) => void
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

  return { expandedSections, toggleSection, isExpanded }
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
      onClick={onToggle}
      className="group w-full flex items-center gap-3 px-5 py-3.5 transition-all duration-300 hover:bg-stone-800/30"
    >
      <div className={cn(
        "flex items-center justify-center w-7 h-7 rounded-md transition-all duration-300",
        isExpanded 
          ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400" 
          : "bg-stone-800/50 text-stone-500 group-hover:text-stone-400"
      )}>
        {icon}
      </div>
      <span className={cn(
        "flex-1 text-left text-[13px] font-medium tracking-wide transition-colors duration-300",
        isExpanded ? "text-stone-200" : "text-stone-400 group-hover:text-stone-300"
      )}>
        {title}
      </span>
      <ChevronDown className={cn(
        "w-4 h-4 text-stone-600 transition-all duration-300 group-hover:text-stone-500",
        isExpanded && "rotate-180 text-amber-500/60"
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
        <div className="px-5 pb-5 pt-1 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          {children}
        </div>
      </div>
      
      {/* Elegant divider */}
      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-stone-700/50 to-transparent" />
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
    if (e.key === 'Enter' && onImmediateChange && validation?.isValid) {
      onImmediateChange(validation.sanitizedValue.toString())
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
      <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
        {label}
      </label>
      <div className="relative">
        <div className={cn(
          "relative group rounded-lg transition-all duration-300",
          isFocused 
            ? "ring-2 ring-amber-500/30 ring-offset-1 ring-offset-stone-900" 
            : "hover:ring-1 hover:ring-stone-600"
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
              "w-full h-9 px-3 text-[13px] font-medium",
              "bg-stone-800/60 text-stone-200 placeholder:text-stone-600",
              "border rounded-lg",
              "focus:outline-none focus:bg-stone-800",
              "transition-all duration-300",
              getBorderColor() || "border-stone-700/50"
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

  const displayColor = localValue === 'transparent' ? '#00000000' : localValue || '#000000'

  const getBorderColor = () => {
    if (!validation || !localValue) return 'border-stone-700/50'
    if (!validation.isValid) return 'border-red-500/50'
    if (validation.warning) return 'border-amber-500/50'
    return 'border-stone-700/50'
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
        {label}
      </label>
      <div className="relative">
        <div className={cn(
          "flex items-center gap-2 p-1.5 rounded-lg transition-all duration-300",
          "bg-stone-800/60 border",
          getBorderColor(),
          isFocused && "ring-2 ring-amber-500/30 ring-offset-1 ring-offset-stone-900"
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
      <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
        {label}
      </label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-9 px-3 text-[13px] font-medium appearance-none cursor-pointer",
          "bg-stone-800/60 text-stone-200 border border-stone-700/50 rounded-lg",
          "focus:outline-none focus:ring-2 focus:ring-amber-500/30",
          "hover:border-stone-600 transition-all duration-300",
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
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0
  const percentage = ((numValue - min) / (max - min)) * 100
  const [isDragging, setIsDragging] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    onChange(newValue)
  }

  const handleMouseUp = () => {
    if (isDragging && onChangeComplete) {
      onChangeComplete(numValue)
    }
    setIsDragging(false)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
          {label}
        </label>
        <span className={cn(
          "text-xs font-bold tabular-nums transition-colors duration-200",
          isDragging ? "text-amber-300" : "text-amber-400/80"
        )}>
          {numValue.toFixed(step < 1 ? 2 : 0)}{unit}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-stone-800 overflow-hidden">
        <div 
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all",
            isDragging ? "bg-gradient-to-r from-amber-400 to-orange-400 duration-75" : "bg-gradient-to-r from-amber-500/80 to-orange-500/80 duration-150"
          )}
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          value={numValue}
          onChange={handleChange}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={handleMouseUp}
          min={min}
          max={max}
          step={step}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
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
      <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
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
          "w-full px-3 py-2 text-[13px] font-mono resize-none",
          "bg-stone-800/60 text-stone-200 placeholder:text-stone-600",
          "border border-stone-700/50 rounded-lg",
          "focus:outline-none focus:ring-2 focus:ring-amber-500/30",
          "transition-all duration-300"
        )}
      />
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
      <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
        {label}
      </label>
      <div className="flex gap-1 p-1 bg-stone-800/60 rounded-lg border border-stone-700/50">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 flex items-center justify-center py-2 rounded-md transition-all duration-200",
              value === opt.value 
                ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 shadow-inner" 
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
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StylePanel({
  selectedElement,
  onStyleChange,
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
  const { toggleSection, isExpanded } = useSectionState()
  const [position, setPosition] = useState(initialPosition || { x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  
  // Debounced handlers for different update frequencies
  const styleChangeHandlers = useDebounce(onStyleChange, 100)
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
    styleChangeHandlers.debounced(property, value)
  }, [styleChangeHandlers])

  // Immediate style change (for sliders on mouse up, etc.)
  const handleImmediateStyleChange = useCallback((property: string, value: StyleProperty) => {
    styleChangeHandlers.immediate(property, value, true)
  }, [styleChangeHandlers])

  const handlePropertyChange = useCallback((key: string, value: string) => {
    elementChangeHandlers.debounced({
      ...selectedElement,
      properties: {
        ...selectedElement.properties,
        [key]: value,
      },
    })
  }, [selectedElement, elementChangeHandlers])

  const visibleSections = useMemo(() => {
    const type = selectedElement.type.toLowerCase()
    const sections = ['size', 'spacing', 'layout', 'typography', 'colors', 'border', 'effects', 'attributes']
    
    if (['a', 'link'].includes(type)) {
      sections.push('link')
    }
    if (['img', 'image'].includes(type)) {
      sections.push('image')
    }
    
    return sections
  }, [selectedElement.type])

  return (
    <div
      ref={panelRef}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
      className={cn(
        "w-80 max-h-[540px] rounded-2xl flex flex-col overflow-hidden",
        "bg-gradient-to-b from-stone-900 via-stone-900 to-stone-950",
        "border border-stone-700/40 shadow-2xl shadow-black/40",
        "animate-in fade-in slide-in-from-right-4 duration-300",
        isDragging && "cursor-grabbing select-none",
        className
      )}
    >
      {/* Compact Draggable Header */}
      <div 
        onMouseDown={handleMouseDown}
        className={cn(
          "relative px-4 py-2.5 border-b border-stone-800/60",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-orange-500/5 pointer-events-none" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-amber-400 animate-ping opacity-30" />
            </div>
            <span className="text-xs font-semibold text-stone-300 tracking-wide">
              {selectedElement.type}
            </span>
            <span className="text-[9px] text-stone-600 font-medium">drag to move</span>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Undo/Redo buttons */}
            <button
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                canUndo 
                  ? "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 active:scale-95" 
                  : "text-stone-700 cursor-not-allowed"
              )}
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                canRedo 
                  ? "text-stone-400 hover:text-stone-200 hover:bg-stone-800/60 active:scale-95" 
                  : "text-stone-700 cursor-not-allowed"
              )}
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
            
            <div className="w-px h-4 bg-stone-700/50 mx-1" />
            
            <button
              onClick={onClose}
              className={cn(
                "p-1.5 rounded-md transition-all duration-200",
                "text-stone-500 hover:text-stone-300",
                "hover:bg-stone-800/60 active:scale-95"
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
            <div className="space-y-3">
              <p className="text-[10px] font-bold tracking-widest text-amber-500/60 uppercase">Margin</p>
              <div className="grid grid-cols-4 gap-2">
                <StyledInput label="Top" value={selectedElement.styles.marginTop?.toString() || ''} onChange={(v) => handleStyleChange('marginTop', v)} onImmediateChange={(v) => handleImmediateStyleChange('marginTop', v)} property="marginTop" compact />
                <StyledInput label="Right" value={selectedElement.styles.marginRight?.toString() || ''} onChange={(v) => handleStyleChange('marginRight', v)} onImmediateChange={(v) => handleImmediateStyleChange('marginRight', v)} property="marginRight" compact />
                <StyledInput label="Bottom" value={selectedElement.styles.marginBottom?.toString() || ''} onChange={(v) => handleStyleChange('marginBottom', v)} onImmediateChange={(v) => handleImmediateStyleChange('marginBottom', v)} property="marginBottom" compact />
                <StyledInput label="Left" value={selectedElement.styles.marginLeft?.toString() || ''} onChange={(v) => handleStyleChange('marginLeft', v)} onImmediateChange={(v) => handleImmediateStyleChange('marginLeft', v)} property="marginLeft" compact />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold tracking-widest text-amber-500/60 uppercase">Padding</p>
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
            <div className="grid grid-cols-2 gap-3">
              <StyledInput
                label="Size"
                value={selectedElement.styles.fontSize?.toString() || ''}
                onChange={(v) => handleStyleChange('fontSize', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('fontSize', v)}
                placeholder="16px"
                property="fontSize"
              />
              <StyledInput
                label="Weight"
                value={selectedElement.styles.fontWeight?.toString() || ''}
                onChange={(v) => handleStyleChange('fontWeight', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('fontWeight', v)}
                placeholder="400"
                property="fontWeight"
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
            <div className="grid grid-cols-2 gap-3">
              <StyledInput
                label="Width"
                value={selectedElement.styles.borderWidth?.toString() || ''}
                onChange={(v) => handleStyleChange('borderWidth', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('borderWidth', v)}
                placeholder="0"
                property="borderWidth"
              />
              <StyledInput
                label="Radius"
                value={selectedElement.styles.borderRadius?.toString() || ''}
                onChange={(v) => handleStyleChange('borderRadius', v)}
                onImmediateChange={(v) => handleImmediateStyleChange('borderRadius', v)}
                placeholder="0"
                property="borderRadius"
              />
            </div>
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

        {/* Attributes Section */}
        {visibleSections.includes('attributes') && (
          <Section
            name="attributes"
            title="Attributes"
            icon={SECTION_ICONS.attributes}
            isExpanded={isExpanded('attributes')}
            onToggle={() => toggleSection('attributes')}
          >
            <StyledInput
              label="ID"
              value={selectedElement.properties?.id || ''}
              onChange={(v) => handlePropertyChange('id', v)}
              placeholder="element-id"
            />
            <StyledInput
              label="Class"
              value={selectedElement.properties?.className || ''}
              onChange={(v) => handlePropertyChange('className', v)}
              placeholder="class-names"
            />
          </Section>
        )}

        {/* Link Section */}
        {visibleSections.includes('link') && (
          <Section
            name="link"
            title="Link"
            icon={SECTION_ICONS.link}
            isExpanded={isExpanded('link')}
            onToggle={() => toggleSection('link')}
          >
            <StyledInput
              label="Href"
              value={selectedElement.properties?.href || ''}
              onChange={(v) => handlePropertyChange('href', v)}
              placeholder="https://..."
            />
          </Section>
        )}

        {/* Image Section */}
        {visibleSections.includes('image') && (
          <Section
            name="image"
            title="Image"
            icon={SECTION_ICONS.image}
            isExpanded={isExpanded('image')}
            onToggle={() => toggleSection('image')}
          >
            <StyledInput
              label="Source"
              value={selectedElement.properties?.src || ''}
              onChange={(v) => handlePropertyChange('src', v)}
              placeholder="image url..."
            />
            <StyledInput
              label="Alt Text"
              value={selectedElement.properties?.alt || ''}
              onChange={(v) => handlePropertyChange('alt', v)}
              placeholder="description..."
            />
          </Section>
        )}
        
        {/* Bottom padding for scroll */}
        <div className="h-4" />
      </div>
    </div>
  )
}
