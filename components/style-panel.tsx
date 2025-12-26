"use client"

import { useState, useCallback, useMemo, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
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
  Image as ImageIcon
} from "lucide-react"

// ============================================================================
// TYPES
// ============================================================================

export type StyleProperty = string | number

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
  onStyleChange: (property: string, value: StyleProperty) => void
  onElementChange: (element: SelectedElement) => void
  onClose: () => void
  className?: string
  initialPosition?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
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

function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 300
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => callback(...args), delay)
  }, [callback, delay]) as T
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
      {/* Ink bleed accent on expanded sections */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-all duration-500 ease-out",
        isExpanded 
          ? "bg-gradient-to-b from-amber-500 via-orange-500 to-rose-500 opacity-100" 
          : "opacity-0"
      )} />
      
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
  placeholder?: string
  unit?: string
  compact?: boolean
}

function StyledInput({ label, value, onChange, placeholder, unit, compact }: StyledInputProps) {
  const [localValue, setLocalValue] = useState(value?.toString() || '')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    setLocalValue(value?.toString() || '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setLocalValue(newValue)
    onChange(newValue)
  }

  return (
    <div className={cn("flex flex-col gap-1.5", compact && "flex-1")}>
      <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
        {label}
      </label>
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
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className={cn(
            "w-full h-9 px-3 text-[13px] font-medium",
            "bg-stone-800/60 text-stone-200 placeholder:text-stone-600",
            "border border-stone-700/50 rounded-lg",
            "focus:outline-none focus:bg-stone-800",
            "transition-all duration-300"
          )}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-600">
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

interface ColorInputProps {
  label: string
  value: string
  onChange: (value: string) => void
}

function ColorInput({ label, value, onChange }: ColorInputProps) {
  const [localValue, setLocalValue] = useState(value || '')
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
    onChange(e.target.value)
  }

  const displayColor = localValue === 'transparent' ? '#00000000' : localValue || '#000000'

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
        {label}
      </label>
      <div className={cn(
        "flex items-center gap-2 p-1.5 rounded-lg transition-all duration-300",
        "bg-stone-800/60 border border-stone-700/50",
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
            onChange={handleChange}
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
          onBlur={() => setIsFocused(false)}
          placeholder="#000000"
          className="flex-1 h-7 px-2 text-xs font-mono text-stone-300 bg-transparent focus:outline-none"
        />
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
  min?: number
  max?: number
  step?: number
  unit?: string
}

function StyledSlider({ label, value, onChange, min = 0, max = 100, step = 1, unit = '' }: StyledSliderProps) {
  const numValue = typeof value === 'number' ? value : parseFloat(value) || 0
  const percentage = ((numValue - min) / (max - min)) * 100

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold tracking-widest text-stone-500 uppercase">
          {label}
        </label>
        <span className="text-xs font-bold text-amber-400/80 tabular-nums">
          {numValue}{unit}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-stone-800 overflow-hidden">
        <div 
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-amber-500/80 to-orange-500/80 transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />
        <input
          type="range"
          value={numValue}
          onChange={(e) => onChange(parseFloat(e.target.value))}
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
}: StylePanelProps) {
  const { toggleSection, isExpanded } = useSectionState()
  const [position, setPosition] = useState(initialPosition || { x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  
  const debouncedStyleChange = useDebounce(onStyleChange, 300)
  const debouncedElementChange = useDebounce(onElementChange, 300)

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

  const handleStyleChange = useCallback((property: string, value: StyleProperty) => {
    debouncedStyleChange(property, value)
  }, [debouncedStyleChange])

  const handlePropertyChange = useCallback((key: string, value: string) => {
    debouncedElementChange({
      ...selectedElement,
      properties: {
        ...selectedElement.properties,
        [key]: value,
      },
    })
  }, [selectedElement, debouncedElementChange])

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
                placeholder="auto"
              />
              <StyledInput
                label="Height"
                value={selectedElement.styles.height?.toString() || ''}
                onChange={(v) => handleStyleChange('height', v)}
                placeholder="auto"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StyledInput
                label="Min Width"
                value={selectedElement.styles.minWidth?.toString() || ''}
                onChange={(v) => handleStyleChange('minWidth', v)}
                placeholder="none"
              />
              <StyledInput
                label="Max Width"
                value={selectedElement.styles.maxWidth?.toString() || ''}
                onChange={(v) => handleStyleChange('maxWidth', v)}
                placeholder="none"
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
                <StyledInput label="Top" value={selectedElement.styles.marginTop?.toString() || ''} onChange={(v) => handleStyleChange('marginTop', v)} compact />
                <StyledInput label="Right" value={selectedElement.styles.marginRight?.toString() || ''} onChange={(v) => handleStyleChange('marginRight', v)} compact />
                <StyledInput label="Bottom" value={selectedElement.styles.marginBottom?.toString() || ''} onChange={(v) => handleStyleChange('marginBottom', v)} compact />
                <StyledInput label="Left" value={selectedElement.styles.marginLeft?.toString() || ''} onChange={(v) => handleStyleChange('marginLeft', v)} compact />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] font-bold tracking-widest text-amber-500/60 uppercase">Padding</p>
              <div className="grid grid-cols-4 gap-2">
                <StyledInput label="Top" value={selectedElement.styles.paddingTop?.toString() || ''} onChange={(v) => handleStyleChange('paddingTop', v)} compact />
                <StyledInput label="Right" value={selectedElement.styles.paddingRight?.toString() || ''} onChange={(v) => handleStyleChange('paddingRight', v)} compact />
                <StyledInput label="Bottom" value={selectedElement.styles.paddingBottom?.toString() || ''} onChange={(v) => handleStyleChange('paddingBottom', v)} compact />
                <StyledInput label="Left" value={selectedElement.styles.paddingLeft?.toString() || ''} onChange={(v) => handleStyleChange('paddingLeft', v)} compact />
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
                onChange={(v) => handleStyleChange('display', v)}
                options={DISPLAY_OPTIONS}
              />
              <StyledDropdown
                label="Position"
                value={selectedElement.styles.position?.toString() || ''}
                onChange={(v) => handleStyleChange('position', v)}
                options={POSITION_OPTIONS}
              />
            </div>
            <StyledDropdown
              label="Flex Direction"
              value={selectedElement.styles.flexDirection?.toString() || ''}
              onChange={(v) => handleStyleChange('flexDirection', v)}
              options={FLEX_DIRECTION_OPTIONS}
            />
            <div className="grid grid-cols-2 gap-3">
              <StyledDropdown
                label="Justify"
                value={selectedElement.styles.justifyContent?.toString() || ''}
                onChange={(v) => handleStyleChange('justifyContent', v)}
                options={JUSTIFY_OPTIONS}
              />
              <StyledDropdown
                label="Align"
                value={selectedElement.styles.alignItems?.toString() || ''}
                onChange={(v) => handleStyleChange('alignItems', v)}
                options={ALIGN_OPTIONS}
              />
            </div>
            <StyledInput
              label="Gap"
              value={selectedElement.styles.gap?.toString() || ''}
              onChange={(v) => handleStyleChange('gap', v)}
              placeholder="0"
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
                placeholder="16px"
              />
              <StyledInput
                label="Weight"
                value={selectedElement.styles.fontWeight?.toString() || ''}
                onChange={(v) => handleStyleChange('fontWeight', v)}
                placeholder="400"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <StyledInput
                label="Line Height"
                value={selectedElement.styles.lineHeight?.toString() || ''}
                onChange={(v) => handleStyleChange('lineHeight', v)}
                placeholder="1.5"
              />
              <StyledInput
                label="Letter Spacing"
                value={selectedElement.styles.letterSpacing?.toString() || ''}
                onChange={(v) => handleStyleChange('letterSpacing', v)}
                placeholder="normal"
              />
            </div>
            <AlignmentButtons
              label="Text Align"
              value={selectedElement.styles.textAlign?.toString() || ''}
              onChange={(v) => handleStyleChange('textAlign', v)}
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
            />
            <ColorInput
              label="Background"
              value={selectedElement.styles.backgroundColor?.toString() || ''}
              onChange={(v) => handleStyleChange('backgroundColor', v)}
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
                placeholder="0"
              />
              <StyledInput
                label="Radius"
                value={selectedElement.styles.borderRadius?.toString() || ''}
                onChange={(v) => handleStyleChange('borderRadius', v)}
                placeholder="0"
              />
            </div>
            <ColorInput
              label="Border Color"
              value={selectedElement.styles.borderColor?.toString() || ''}
              onChange={(v) => handleStyleChange('borderColor', v)}
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
              min={0}
              max={100}
              unit="%"
            />
            <StyledDropdown
              label="Overflow"
              value={selectedElement.styles.overflow?.toString() || ''}
              onChange={(v) => handleStyleChange('overflow', v)}
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
