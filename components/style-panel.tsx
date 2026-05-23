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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  Check,
  Plus,
  Minus,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalSpaceBetween,
  AlignHorizontalSpaceAround,
  StretchHorizontal,
  Eye,
  EyeOff,
  ScrollText,
  MousePointer2,
  Pin,
  Box,
  Crosshair,
  Wand2,
  Link as LinkIcon,
  Unlink,
  RotateCcw,
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

interface SegmentOption {
  value: string
  label: string
  icon?: React.ReactNode
  tooltip?: string
}

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

function useSectionState(storageKey: string = "style-panel-sections") {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set(["size"])
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? new Set(JSON.parse(stored)) : new Set(["size"])
    } catch {
      return new Set(["size"])
    }
  })

  const toggleSection = useCallback(
    (sectionName: string) => {
      setExpandedSections((prev) => {
        const next = new Set(prev)
        if (next.has(sectionName)) next.delete(sectionName)
        else next.add(sectionName)
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]))
        } catch {}
        return next
      })
    },
    [storageKey]
  )

  const isExpanded = useCallback(
    (sectionName: string) => expandedSections.has(sectionName),
    [expandedSections]
  )

  const expandSections = useCallback(
    (sectionNames: string[]) => {
      setExpandedSections(() => {
        const next = new Set(sectionNames)
        try {
          localStorage.setItem(storageKey, JSON.stringify([...next]))
        } catch {}
        return next
      })
    },
    [storageKey]
  )

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

function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number = 150
): { debounced: T; immediate: T; cancel: () => void } {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const callbackRef = useRef(callback)

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

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      cancel()
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args)
      }, delay)
    },
    [cancel, delay]
  ) as T

  const immediate = useCallback(
    (...args: Parameters<T>) => {
      cancel()
      callbackRef.current(...args)
    },
    [cancel]
  ) as T

  return { debounced, immediate, cancel }
}

// ============================================================================
// HELPERS
// ============================================================================

const SUPPORTED_UNITS = ["px", "%", "em", "rem", "vh", "vw"] as const
type CssUnit = (typeof SUPPORTED_UNITS)[number]

function extractNumericValue(value: StyleProperty | undefined, fallback = 0) {
  if (typeof value === "number") return value
  if (!value) return fallback
  const parsed = parseFloat(value.toString())
  return Number.isFinite(parsed) ? parsed : fallback
}

function extractUnit(value: StyleProperty | undefined, fallback: CssUnit = "px"): CssUnit {
  if (typeof value !== "string") return fallback
  const match = value.match(/(px|%|em|rem|vh|vw)$/i)
  return (match ? (match[1].toLowerCase() as CssUnit) : fallback) as CssUnit
}

function isKeywordValue(value: StyleProperty | undefined): boolean {
  if (typeof value !== "string") return false
  const v = value.trim().toLowerCase()
  return ["auto", "none", "inherit", "initial", "unset", "fit-content", "max-content", "min-content"].includes(v)
}

function toCssLength(value: number, unit: string = "px") {
  const normalized = Number.isInteger(value)
    ? value.toString()
    : value
        .toFixed(2)
        .replace(/\.00$/, "")
        .replace(/(\.\d*[1-9])0+$/, "$1")
  return `${normalized}${unit}`
}

// ============================================================================
// PRIMITIVES
// ============================================================================

interface IconButtonProps {
  icon: React.ReactNode
  tooltip: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  size?: "sm" | "md"
  variant?: "default" | "ghost"
}

function IconButton({
  icon,
  tooltip,
  active,
  disabled,
  onClick,
  size = "md",
  variant = "default",
}: IconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={tooltip}
          aria-pressed={active}
          className={cn(
            "inline-flex items-center justify-center rounded-md transition-all duration-150",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-400/60",
            size === "sm" ? "h-6 w-6" : "h-7 w-7",
            disabled && "cursor-not-allowed opacity-40",
            !disabled && variant === "default" && [
              active
                ? "bg-stone-100 text-stone-900 shadow-sm"
                : "text-stone-400 hover:bg-stone-800/70 hover:text-stone-100 active:scale-[0.96]",
            ],
            !disabled && variant === "ghost" && [
              active
                ? "text-stone-100"
                : "text-stone-400 hover:bg-stone-800/60 hover:text-stone-100 active:scale-[0.96]",
            ]
          )}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-stone-100 text-stone-900 text-[10px] font-medium px-2 py-1">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

interface FieldLabelProps {
  label: string
  onReset?: () => void
  hasValue?: boolean
  className?: string
  rightSlot?: React.ReactNode
}

function FieldLabel({ label, onReset, hasValue, className, rightSlot }: FieldLabelProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2 min-h-[14px]", className)}>
      <div className="flex items-center gap-1 min-w-0">
        <label className="text-[10.5px] font-medium uppercase tracking-wide text-stone-500 truncate">
          {label}
        </label>
        {onReset && hasValue && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onReset}
                aria-label={`Reset ${label}`}
                className="flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded text-stone-600 opacity-0 transition-all hover:bg-stone-800/80 hover:text-stone-200 group-hover/field:opacity-100 focus-visible:opacity-100 focus:outline-none"
              >
                <RotateCcw className="h-2.5 w-2.5" strokeWidth={2.5} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-stone-100 text-stone-900 text-[10px] font-medium px-2 py-1">
              Reset to default
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {rightSlot}
    </div>
  )
}

interface SegmentedControlProps<T extends string = string> {
  label?: string
  value: T | ""
  options: SegmentOption[]
  onChange: (value: T) => void
  onReset?: () => void
  size?: "sm" | "md"
}

function SegmentedControl<T extends string = string>({
  label,
  value,
  options,
  onChange,
  onReset,
  size = "md",
}: SegmentedControlProps<T>) {
  return (
    <div className="group/field flex flex-col gap-1.5">
      {label && (
        <FieldLabel
          label={label}
          onReset={onReset}
          hasValue={!!value}
        />
      )}
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-md border border-stone-800/80 bg-stone-900/60 p-0.5",
          size === "sm" ? "h-7" : "h-8"
        )}
      >
        {options.map((opt) => {
          const isActive = value === opt.value
          const button = (
            <button
              type="button"
              key={opt.value}
              onClick={() => onChange(opt.value as T)}
              aria-pressed={isActive}
              aria-label={opt.tooltip || opt.label}
              className={cn(
                "flex-1 inline-flex items-center justify-center gap-1 rounded-[5px] text-[11px] font-medium transition-all duration-150",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-400/60",
                size === "sm" ? "h-6 px-1.5" : "h-7 px-2",
                isActive
                  ? "bg-stone-100 text-stone-900 shadow-sm"
                  : "text-stone-400 hover:bg-stone-800/70 hover:text-stone-100"
              )}
            >
              {opt.icon}
              {opt.label && <span className="truncate">{opt.label}</span>}
            </button>
          )

          if (opt.tooltip) {
            return (
              <Tooltip key={opt.value}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="top" className="bg-stone-100 text-stone-900 text-[10px] font-medium px-2 py-1">
                  {opt.tooltip}
                </TooltipContent>
              </Tooltip>
            )
          }

          return button
        })}
      </div>
    </div>
  )
}

interface PresetChipsProps {
  values: Array<{ label: string; value: string | number }>
  activeValue?: string | number
  onSelect: (value: string | number) => void
  label?: string
}

function PresetChips({ values, activeValue, onSelect, label }: PresetChipsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[10.5px] font-medium uppercase tracking-wide text-stone-500">
          {label}
        </label>
      )}
      <div className="flex flex-wrap gap-1">
        {values.map((preset) => {
          const isActive = activeValue !== undefined && activeValue.toString() === preset.value.toString()
          return (
            <button
              type="button"
              key={`${preset.label}-${preset.value}`}
              onClick={() => onSelect(preset.value)}
              aria-pressed={isActive}
              className={cn(
                "h-6 rounded-full px-2.5 text-[10.5px] font-medium tracking-wide transition-all duration-150",
                "focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-400/60",
                isActive
                  ? "bg-stone-100 text-stone-900 shadow-sm"
                  : "bg-stone-800/60 text-stone-400 hover:bg-stone-800 hover:text-stone-100 border border-stone-700/40"
              )}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface NumberInputProps {
  label?: string
  value: number | ""
  onChange: (value: number) => void
  onCommit?: (value: number) => void
  onReset?: () => void
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  unit?: string
  placeholder?: string
  showStepper?: boolean
  className?: string
}

function NumberInput({
  label,
  value,
  onChange,
  onCommit,
  onReset,
  defaultValue,
  min,
  max,
  step = 1,
  unit,
  placeholder,
  showStepper = true,
  className,
}: NumberInputProps) {
  const [localValue, setLocalValue] = useState<string>(value === "" ? "" : value.toString())
  const [isFocused, setIsFocused] = useState(false)

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(value === "" ? "" : value.toString())
    }
  }, [value, isFocused])

  const clamp = useCallback(
    (n: number) => {
      let v = n
      if (typeof min === "number") v = Math.max(min, v)
      if (typeof max === "number") v = Math.min(max, v)
      return v
    },
    [min, max]
  )

  const commit = useCallback(
    (raw: string) => {
      if (raw === "") {
        onChange(0)
        onCommit?.(0)
        return
      }
      const parsed = parseFloat(raw)
      if (!Number.isFinite(parsed)) return
      const v = clamp(parsed)
      setLocalValue(v.toString())
      onChange(v)
      onCommit?.(v)
    },
    [clamp, onChange, onCommit]
  )

  const handleStep = useCallback(
    (direction: 1 | -1) => {
      const current = parseFloat(localValue) || 0
      const next = clamp(current + direction * step)
      setLocalValue(next.toString())
      onChange(next)
      onCommit?.(next)
    },
    [localValue, step, clamp, onChange, onCommit]
  )

  const hasValue =
    value !== "" && value !== undefined && (defaultValue === undefined || value !== defaultValue)

  return (
    <div className={cn("group/field flex flex-col gap-1.5", className)}>
      {label && (
        <FieldLabel label={label} onReset={onReset} hasValue={!!onReset && hasValue} />
      )}
      <div
        className={cn(
          "group flex h-7 items-center rounded-md border border-stone-800/80 bg-stone-900/60",
          "transition-colors duration-150",
          isFocused
            ? "border-stone-500/70 bg-stone-900 ring-1 ring-stone-500/30"
            : "hover:border-stone-700"
        )}
      >
        {showStepper && (
          <button
            type="button"
            onClick={() => handleStep(-1)}
            aria-label="Decrease"
            className="flex h-full w-5 flex-shrink-0 items-center justify-center rounded-l-md text-stone-500 hover:bg-stone-800/80 hover:text-stone-200 transition-colors"
          >
            <Minus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={localValue}
          onChange={(e) => {
            const v = e.target.value
            if (/^-?\d*\.?\d*$/.test(v) || v === "") {
              setLocalValue(v)
              const parsed = parseFloat(v)
              if (Number.isFinite(parsed)) onChange(clamp(parsed))
            }
          }}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            commit(localValue)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              commit(localValue)
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              handleStep(1)
            } else if (e.key === "ArrowDown") {
              e.preventDefault()
              handleStep(-1)
            }
          }}
          placeholder={placeholder}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-1 text-center text-[11.5px] font-mono text-stone-100",
            "placeholder:text-stone-600 focus:outline-none"
          )}
        />
        {unit && (
          <span className="pr-1 text-[9.5px] font-semibold uppercase tracking-wider text-stone-500">
            {unit}
          </span>
        )}
        {showStepper && (
          <button
            type="button"
            onClick={() => handleStep(1)}
            aria-label="Increase"
            className="flex h-full w-5 flex-shrink-0 items-center justify-center rounded-r-md text-stone-500 hover:bg-stone-800/80 hover:text-stone-200 transition-colors"
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        )}
      </div>
    </div>
  )
}

interface UnitToggleProps {
  unit: CssUnit
  units?: readonly CssUnit[]
  onChange: (unit: CssUnit) => void
  inline?: boolean
}

function UnitToggle({ unit, units = SUPPORTED_UNITS, onChange, inline = false }: UnitToggleProps) {
  const handleClick = () => {
    const idx = units.indexOf(unit)
    const next = units[(idx + 1) % units.length]
    onChange(next)
  }

  if (inline) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            tabIndex={-1}
            className="flex h-full flex-shrink-0 items-center px-1.5 text-[9.5px] font-semibold uppercase tracking-wider text-stone-400 transition-colors hover:bg-stone-800/80 hover:text-stone-100"
          >
            {unit === "%" ? "%" : unit}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-stone-100 text-stone-900 text-[10px] font-medium px-2 py-1">
          Switch unit
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          className="h-7 min-w-[34px] flex-shrink-0 rounded-md border border-stone-800/80 bg-stone-900/60 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-stone-300 transition-colors hover:border-stone-700 hover:bg-stone-800/80"
        >
          {unit === "%" ? "%" : unit}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="bg-stone-100 text-stone-900 text-[10px] font-medium px-2 py-1">
        Switch unit
      </TooltipContent>
    </Tooltip>
  )
}

// ============================================================================
// COMPOSITE CONTROLS
// ============================================================================

interface DimensionControlProps {
  label: string
  value: StyleProperty | undefined
  property: string
  onLiveChange: (property: string, value: StyleProperty) => void
  onCommit: (property: string, value: StyleProperty) => void
  onReset?: () => void
  presets?: Array<{ label: string; value: string }>
  showSlider?: boolean
  sliderMax?: number
  showStepper?: boolean
}

function DimensionControl({
  label,
  value,
  property,
  onLiveChange,
  onCommit,
  onReset,
  presets,
  showSlider = false,
  sliderMax = 1000,
  showStepper = true,
}: DimensionControlProps) {
  const isKeyword = isKeywordValue(value)
  const numeric = extractNumericValue(value, 0)
  const unit = extractUnit(value, "px")
  const hasValue = value !== undefined && value !== "" && value !== null

  const handleNumberChange = (n: number) => {
    onLiveChange(property, toCssLength(n, unit))
  }
  const handleNumberCommit = (n: number) => {
    onCommit(property, toCssLength(n, unit))
  }
  const handleUnitChange = (u: CssUnit) => {
    onCommit(property, toCssLength(numeric, u))
  }

  return (
    <div className="group/field flex flex-col gap-1.5 min-w-0">
      <FieldLabel
        label={label}
        onReset={onReset}
        hasValue={!!onReset && hasValue}
        rightSlot={
          isKeyword && typeof value === "string" ? (
            <span className="text-[10px] font-mono text-stone-400 truncate">{value}</span>
          ) : undefined
        }
      />
      <div
        className={cn(
          "group flex h-7 w-full min-w-0 items-center rounded-md border border-stone-800/80 bg-stone-900/60",
          "transition-colors duration-150 hover:border-stone-700",
          "focus-within:border-stone-500/70 focus-within:bg-stone-900 focus-within:ring-1 focus-within:ring-stone-500/30"
        )}
      >
        {showStepper && (
          <button
            type="button"
            onClick={() => handleNumberCommit(Math.max(0, numeric - 1))}
            aria-label="Decrease"
            className="flex h-full w-5 flex-shrink-0 items-center justify-center rounded-l-md text-stone-500 hover:bg-stone-800/80 hover:text-stone-200 transition-colors"
          >
            <Minus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        )}
        <DimensionNumberInput
          value={isKeyword ? "" : numeric}
          placeholder={isKeyword && typeof value === "string" ? value : "0"}
          onChange={handleNumberChange}
          onCommit={handleNumberCommit}
        />
        <UnitToggle unit={unit} onChange={handleUnitChange} inline />
        {showStepper && (
          <button
            type="button"
            onClick={() => handleNumberCommit(numeric + 1)}
            aria-label="Increase"
            className="flex h-full w-5 flex-shrink-0 items-center justify-center rounded-r-md text-stone-500 hover:bg-stone-800/80 hover:text-stone-200 transition-colors"
          >
            <Plus className="h-3 w-3" strokeWidth={2.5} />
          </button>
        )}
      </div>
      {presets && presets.length > 0 && (
        <PresetChips
          values={presets}
          activeValue={typeof value === "string" ? value : undefined}
          onSelect={(v) => onCommit(property, v as string)}
        />
      )}
      {showSlider && !isKeyword && (
        <Slider
          value={numeric}
          min={0}
          max={sliderMax}
          step={1}
          onChange={(n) => onLiveChange(property, toCssLength(n, unit))}
          onChangeComplete={(n) => onCommit(property, toCssLength(n, unit))}
          hideValue
        />
      )}
    </div>
  )
}

interface DimensionNumberInputProps {
  value: number | ""
  placeholder?: string
  onChange: (v: number) => void
  onCommit: (v: number) => void
}

function DimensionNumberInput({ value, placeholder, onChange, onCommit }: DimensionNumberInputProps) {
  const [local, setLocal] = useState<string>(value === "" ? "" : value.toString())
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setLocal(value === "" ? "" : value.toString())
    }
  }, [value, focused])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value
        if (/^-?\d*\.?\d*$/.test(v) || v === "") {
          setLocal(v)
          const parsed = parseFloat(v)
          if (Number.isFinite(parsed)) onChange(parsed)
        }
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        const parsed = parseFloat(local)
        if (Number.isFinite(parsed)) onCommit(parsed)
        else if (local === "") onCommit(0)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          const parsed = parseFloat(local)
          if (Number.isFinite(parsed)) onCommit(parsed)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className="min-w-0 flex-1 bg-transparent px-1.5 text-center text-[11.5px] font-mono text-stone-100 placeholder:text-stone-600 focus:outline-none"
    />
  )
}

interface SliderProps {
  label?: string
  value: number
  onChange: (value: number) => void
  onChangeComplete?: (value: number) => void
  onReset?: () => void
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  unit?: string
  hideValue?: boolean
}

function Slider({
  label,
  value,
  onChange,
  onChangeComplete,
  onReset,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  hideValue = false,
}: SliderProps) {
  const [localValue, setLocalValue] = useState(value)
  const [isDragging, setIsDragging] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)

  useEffect(() => {
    if (!isDragging && !isInputFocused) setLocalValue(value)
  }, [value, isDragging, isInputFocused])

  const snapToStep = useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, next))
      const stepped = Math.round((clamped - min) / step) * step + min
      const precision = step.toString().includes(".") ? step.toString().split(".")[1]?.length || 0 : 0
      return precision > 0 ? parseFloat(stepped.toFixed(precision)) : stepped
    },
    [min, max, step]
  )

  const apply = (next: number, commit = false) => {
    const v = snapToStep(next)
    setLocalValue(v)
    onChange(v)
    if (commit) onChangeComplete?.(v)
  }

  const percentage = max === min ? 0 : ((localValue - min) / (max - min)) * 100

  return (
    <div className="group/field flex flex-col gap-1.5">
      {(label || !hideValue) && (
        <div className="flex items-center justify-between">
          {label ? (
            <FieldLabel
              label={label}
              onReset={onReset}
              hasValue={!!onReset && (defaultValue === undefined || value !== defaultValue)}
              className="flex-1"
            />
          ) : (
            <div />
          )}
          {!hideValue && (
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={localValue}
                min={min}
                max={max}
                step={step}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => {
                  setIsInputFocused(false)
                  apply(localValue, true)
                }}
                onChange={(e) => {
                  if (e.target.value === "") return
                  const parsed = parseFloat(e.target.value)
                  if (Number.isFinite(parsed)) apply(parsed)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    apply(localValue, true)
                    ;(e.target as HTMLInputElement).blur()
                  }
                }}
                className="h-6 w-12 rounded-md border border-stone-800/80 bg-stone-900/60 px-1 text-right text-[11px] font-mono text-stone-100 outline-none transition-colors focus:border-stone-500/70 focus:bg-stone-900"
              />
              {!!unit && (
                <span className="text-[10px] font-medium uppercase text-stone-500">{unit}</span>
              )}
            </div>
          )}
        </div>
      )}
      <div className="relative h-1.5 rounded-full bg-stone-800">
        <div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all",
            isDragging ? "bg-stone-100 duration-75" : "bg-stone-300 duration-150"
          )}
          style={{ width: `${percentage}%` }}
        />
        <div
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-stone-100 bg-stone-900 transition-shadow",
            isDragging ? "shadow-[0_0_0_4px_rgba(245,245,244,0.15)]" : "shadow-sm"
          )}
          style={{ left: `${percentage}%` }}
        />
        <input
          type="range"
          value={localValue}
          onChange={(e) => apply(parseFloat(e.target.value))}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => {
            if (isDragging) onChangeComplete?.(snapToStep(localValue))
            setIsDragging(false)
          }}
          onMouseLeave={() => {
            if (isDragging) {
              onChangeComplete?.(snapToStep(localValue))
              setIsDragging(false)
            }
          }}
          onTouchStart={() => setIsDragging(true)}
          onTouchEnd={() => {
            if (isDragging) onChangeComplete?.(snapToStep(localValue))
            setIsDragging(false)
          }}
          min={min}
          max={max}
          step={step}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>
    </div>
  )
}

interface ColorInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  onImmediateChange?: (value: string) => void
  onReset?: () => void
  property?: string
}

function ColorInput({ label, value, onChange, onImmediateChange, onReset, property }: ColorInputProps) {
  const [localValue, setLocalValue] = useState(value || "")
  const [isFocused, setIsFocused] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalValue(value || "")
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
      feedbackTimeoutRef.current = setTimeout(() => setShowFeedback(false), 1800)
      if (result.isValid) onChange(result.sanitizedValue.toString())
    } else {
      onChange(newValue)
    }
  }

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setLocalValue(v)
    onChange(v)
    onImmediateChange?.(v)
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (onImmediateChange && validation?.isValid) {
      onImmediateChange(validation.sanitizedValue.toString())
    }
  }

  const displayColor = localValue === "transparent" ? "#00000000" : localValue || "#000000"
  const isValidColor = displayColor.startsWith("#") && displayColor.length >= 4

  return (
    <div className="group/field flex flex-col gap-1.5">
      <FieldLabel label={label} onReset={onReset} hasValue={!!onReset && !!value} />
      <div
        className={cn(
          "group flex h-7 items-center gap-1.5 rounded-md border border-stone-800/80 bg-stone-900/60 px-1 transition-colors",
          isFocused
            ? "border-stone-500/70 bg-stone-900 ring-1 ring-stone-500/30"
            : "hover:border-stone-700"
        )}
      >
        <div className="relative h-5 w-5 overflow-hidden rounded-[4px] ring-1 ring-inset ring-white/10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(45deg, #44403c 25%, transparent 25%), linear-gradient(-45deg, #44403c 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #44403c 75%), linear-gradient(-45deg, transparent 75%, #44403c 75%)`,
              backgroundSize: "6px 6px",
              backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0",
            }}
          />
          <input
            type="color"
            value={isValidColor ? displayColor.slice(0, 7) : "#000000"}
            onChange={handleColorPickerChange}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
          <div
            className="pointer-events-none absolute inset-0"
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
          className="flex-1 bg-transparent text-[11.5px] font-mono text-stone-100 placeholder:text-stone-600 focus:outline-none"
        />
        {validation && localValue && showFeedback && (
          <div className="pr-1">
            {validation.isValid ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-400" />
            )}
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
  onReset?: () => void
  options: DropdownOption[]
  placeholder?: string
}

function StyledDropdown({ label, value, onChange, onReset, options, placeholder = "Select..." }: StyledDropdownProps) {
  return (
    <div className="group/field flex flex-col gap-1.5">
      <FieldLabel label={label} onReset={onReset} hasValue={!!onReset && !!value} />
      <div className="relative">
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "h-7 w-full appearance-none rounded-md border border-stone-800/80 bg-stone-900/60 px-2.5 pr-7",
            "text-[11.5px] font-medium text-stone-100 cursor-pointer",
            "transition-colors hover:border-stone-700 hover:bg-stone-800/60",
            "focus:outline-none focus:border-stone-500/70 focus:ring-1 focus:ring-stone-500/30"
          )}
        >
          <option value="" className="bg-stone-900">
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-stone-900">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-stone-500" />
      </div>
    </div>
  )
}

interface StyledTextAreaProps {
  label: string
  value: string
  onChange: (value: string) => void
  onReset?: () => void
  placeholder?: string
  rows?: number
}

function StyledTextArea({ label, value, onChange, onReset, placeholder, rows = 2 }: StyledTextAreaProps) {
  const [localValue, setLocalValue] = useState(value || "")

  useEffect(() => {
    setLocalValue(value || "")
  }, [value])

  return (
    <div className="group/field flex flex-col gap-1.5">
      <FieldLabel label={label} onReset={onReset} hasValue={!!onReset && !!value} />
      <textarea
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value)
          onChange(e.target.value)
        }}
        placeholder={placeholder}
        rows={rows}
        className={cn(
          "w-full resize-none rounded-md border border-stone-800/80 bg-stone-900/60 px-2.5 py-1.5",
          "text-[11.5px] font-mono text-stone-100 placeholder:text-stone-600",
          "transition-colors hover:border-stone-700",
          "focus:outline-none focus:border-stone-500/70 focus:bg-stone-900 focus:ring-1 focus:ring-stone-500/30"
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
    <div className="flex items-center justify-between gap-3 rounded-md border border-stone-800/80 bg-stone-900/60 px-2.5 py-1.5">
      <label className="text-[11px] font-medium text-stone-300 capitalize">{label}</label>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors duration-150",
          "focus:outline-none focus-visible:ring-1 focus-visible:ring-stone-400/60",
          checked ? "bg-stone-100" : "bg-stone-800"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full transition-all duration-150 shadow-sm",
            checked ? "left-[18px] bg-stone-900" : "left-0.5 bg-stone-400"
          )}
        />
      </button>
    </div>
  )
}

interface StyledTextInputProps {
  label: string
  value: string | number
  onChange: (value: string) => void
  onImmediateChange?: (value: string) => void
  onReset?: () => void
  placeholder?: string
  unit?: string
  property?: string
  showValidation?: boolean
}

function StyledTextInput({
  label,
  value,
  onChange,
  onImmediateChange,
  onReset,
  placeholder,
  unit,
  property,
  showValidation = true,
}: StyledTextInputProps) {
  const [localValue, setLocalValue] = useState(value?.toString() || "")
  const [isFocused, setIsFocused] = useState(false)
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setLocalValue(value?.toString() || "")
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
    if (property && showValidation && newValue) {
      const result = validateStyleValue(property, newValue)
      setValidation(result)
      setShowFeedback(true)
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current)
      feedbackTimeoutRef.current = setTimeout(() => setShowFeedback(false), 1800)
      if (result.isValid) onChange(result.sanitizedValue.toString())
    } else {
      onChange(newValue)
    }
  }

  return (
    <div className="group/field flex flex-col gap-1.5">
      <FieldLabel
        label={label}
        onReset={onReset}
        hasValue={!!onReset && value !== undefined && value !== "" && value !== null}
      />
      <div
        className={cn(
          "group relative flex h-7 items-center rounded-md border border-stone-800/80 bg-stone-900/60 transition-colors",
          isFocused
            ? "border-stone-500/70 bg-stone-900 ring-1 ring-stone-500/30"
            : "hover:border-stone-700"
        )}
      >
        <input
          type="text"
          value={localValue}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false)
            if (onImmediateChange) {
              if (property && validation?.isValid) {
                onImmediateChange(validation.sanitizedValue.toString())
              } else if (!property) {
                onImmediateChange(localValue)
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              if (onImmediateChange) {
                if (property && validation?.isValid) {
                  onImmediateChange(validation.sanitizedValue.toString())
                } else if (!property) {
                  onImmediateChange(localValue)
                }
              }
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent px-2.5 text-[11.5px] font-mono text-stone-100 placeholder:text-stone-600 focus:outline-none"
        />
        {unit && (
          <span className="px-2 text-[10px] font-medium uppercase tracking-wide text-stone-500">
            {unit}
          </span>
        )}
        {showValidation && validation && localValue && showFeedback && (
          <span className="pr-2">
            {validation.isValid ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <AlertCircle className="h-3 w-3 text-red-400" />
            )}
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION
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
      className={cn(
        "group flex w-full items-center gap-2.5 px-3.5 py-2.5 transition-colors duration-150",
        "hover:bg-stone-900/50"
      )}
    >
      <div
        className={cn(
          "flex h-5 w-5 items-center justify-center transition-colors duration-150",
          isExpanded ? "text-stone-200" : "text-stone-500 group-hover:text-stone-300"
        )}
      >
        {icon}
      </div>
      <span
        className={cn(
          "flex-1 text-left text-[11px] font-semibold uppercase tracking-wider transition-colors",
          isExpanded ? "text-stone-100" : "text-stone-400 group-hover:text-stone-200"
        )}
      >
        {title}
      </span>
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 transition-all duration-200",
          isExpanded ? "rotate-180 text-stone-200" : "text-stone-500 group-hover:text-stone-300"
        )}
      />
    </button>
  )
}

interface SectionProps {
  title: string
  icon: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Section({ title, icon, isExpanded, onToggle, children }: SectionProps) {
  return (
    <div className="border-b border-stone-800/60 last:border-b-0">
      <SectionHeader title={title} icon={icon} isExpanded={isExpanded} onToggle={onToggle} />
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          isExpanded ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-3.5 pb-3.5 pt-0.5 space-y-3">{children}</div>
      </div>
    </div>
  )
}

interface SubGroupProps {
  label?: string
  children: React.ReactNode
  rightSlot?: React.ReactNode
}

function SubGroup({ label, children, rightSlot }: SubGroupProps) {
  return (
    <div className="space-y-1.5">
      {(label || rightSlot) && (
        <div className="flex items-center justify-between">
          {label && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
              {label}
            </span>
          )}
          {rightSlot}
        </div>
      )}
      {children}
    </div>
  )
}

// ============================================================================
// SPECIALIZED LAYOUT CONTROLS
// ============================================================================

interface BoxModelControlProps {
  property: "margin" | "padding"
  styles: Record<string, StyleProperty>
  onLiveChange: (property: string, value: StyleProperty) => void
  onCommit: (property: string, value: StyleProperty) => void
}

function BoxModelControl({ property, styles, onLiveChange, onCommit }: BoxModelControlProps) {
  const [linked, setLinked] = useState(false)
  const top = styles[`${property}Top`]?.toString() || ""
  const right = styles[`${property}Right`]?.toString() || ""
  const bottom = styles[`${property}Bottom`]?.toString() || ""
  const left = styles[`${property}Left`]?.toString() || ""

  const sides: Array<{ key: string; label: string; value: string }> = [
    { key: `${property}Top`, label: "T", value: top },
    { key: `${property}Right`, label: "R", value: right },
    { key: `${property}Bottom`, label: "B", value: bottom },
    { key: `${property}Left`, label: "L", value: left },
  ]

  const handleSideChange = (key: string, raw: string, commit: boolean) => {
    const targetUpdate = (k: string, v: string) => {
      if (commit) onCommit(k, v)
      else onLiveChange(k, v)
    }

    if (linked) {
      sides.forEach((s) => targetUpdate(s.key, raw))
    } else {
      targetUpdate(key, raw)
    }
  }

  return (
    <SubGroup
      label={property}
      rightSlot={
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setLinked((v) => !v)}
              aria-pressed={linked}
              className={cn(
                "inline-flex h-5 w-5 items-center justify-center rounded transition-colors",
                linked ? "bg-stone-100 text-stone-900" : "text-stone-500 hover:bg-stone-800/70 hover:text-stone-200"
              )}
            >
              {linked ? <LinkIcon className="h-3 w-3" /> : <Unlink className="h-3 w-3" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="bg-stone-100 text-stone-900 text-[10px] font-medium px-2 py-1">
            {linked ? "Unlink sides" : "Link sides"}
          </TooltipContent>
        </Tooltip>
      }
    >
      <div className="grid grid-cols-4 gap-1.5">
        {sides.map((side) => {
          const numeric = extractNumericValue(side.value, 0)
          const unit = extractUnit(side.value, "px")
          return (
            <div key={side.key} className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "group flex h-7 w-full items-center rounded-md border border-stone-800/80 bg-stone-900/60",
                  "transition-colors duration-150 hover:border-stone-700",
                  "focus-within:border-stone-500/70 focus-within:bg-stone-900 focus-within:ring-1 focus-within:ring-stone-500/30"
                )}
              >
                <DimensionNumberInput
                  value={numeric}
                  onChange={(n) => handleSideChange(side.key, toCssLength(n, unit), false)}
                  onCommit={(n) => handleSideChange(side.key, toCssLength(n, unit), true)}
                />
              </div>
              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-stone-500">
                {side.label}
              </span>
            </div>
          )
        })}
      </div>
    </SubGroup>
  )
}

interface PositionOffsetControlProps {
  styles: Record<string, StyleProperty>
  onLiveChange: (property: string, value: StyleProperty) => void
  onCommit: (property: string, value: StyleProperty) => void
}

function PositionOffsetControl({ styles, onLiveChange, onCommit }: PositionOffsetControlProps) {
  // Visual diagram: T on top, L/R sides, B on bottom around a centered box
  const make = (key: "top" | "right" | "bottom" | "left") => {
    const v = styles[key]?.toString() || ""
    const numeric = extractNumericValue(v, 0)
    const unit = extractUnit(v, "px")
    return {
      key,
      numeric,
      unit,
      onChange: (n: number) => onLiveChange(key, toCssLength(n, unit)),
      onCommit: (n: number) => onCommit(key, toCssLength(n, unit)),
    }
  }
  const top = make("top")
  const right = make("right")
  const bottom = make("bottom")
  const left = make("left")

  const inputCls =
    "h-6 w-14 rounded-md border border-stone-800/80 bg-stone-900/60 px-1 text-center text-[11px] font-mono text-stone-100 outline-none transition-colors hover:border-stone-700 focus:border-stone-500/70 focus:bg-stone-900"

  return (
    <SubGroup label="Offsets">
      <div className="grid grid-cols-3 gap-1.5 rounded-md border border-stone-800/80 bg-stone-900/40 p-3">
        <div />
        <div className="flex justify-center">
          <PositionInput {...top} className={inputCls} placeholder="T" />
        </div>
        <div />
        <div className="flex justify-end">
          <PositionInput {...left} className={inputCls} placeholder="L" />
        </div>
        <div className="flex items-center justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-700 bg-stone-800/60 text-stone-500">
            <Crosshair className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="flex justify-start">
          <PositionInput {...right} className={inputCls} placeholder="R" />
        </div>
        <div />
        <div className="flex justify-center">
          <PositionInput {...bottom} className={inputCls} placeholder="B" />
        </div>
        <div />
      </div>
    </SubGroup>
  )
}

interface PositionInputProps {
  numeric: number
  unit: CssUnit
  onChange: (n: number) => void
  onCommit: (n: number) => void
  className?: string
  placeholder?: string
}

function PositionInput({ numeric, onChange, onCommit, className, placeholder }: PositionInputProps) {
  const [local, setLocal] = useState(numeric.toString())
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setLocal(numeric.toString())
  }, [numeric, focused])

  return (
    <input
      type="text"
      inputMode="decimal"
      value={local}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value
        if (/^-?\d*\.?\d*$/.test(v) || v === "") {
          setLocal(v)
          const parsed = parseFloat(v)
          if (Number.isFinite(parsed)) onChange(parsed)
        }
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        const parsed = parseFloat(local)
        if (Number.isFinite(parsed)) onCommit(parsed)
        else if (local === "") onCommit(0)
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          const parsed = parseFloat(local)
          if (Number.isFinite(parsed)) onCommit(parsed)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className={className}
    />
  )
}

// ============================================================================
// DROPDOWN OPTIONS
// ============================================================================

const FONT_FAMILY_OPTIONS: DropdownOption[] = [
  { value: "inherit", label: "Inherit" },
  { value: '"DM Sans", sans-serif', label: "DM Sans" },
  { value: '"Playfair Display", serif', label: "Playfair" },
  { value: '"JetBrains Mono", monospace', label: "JetBrains Mono" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "system-ui", label: "System UI" },
]

const FONT_WEIGHT_OPTIONS: SegmentOption[] = [
  { value: "300", label: "Light" },
  { value: "400", label: "Regular" },
  { value: "500", label: "Medium" },
  { value: "600", label: "Semi" },
  { value: "700", label: "Bold" },
]

const DISPLAY_SEGMENTS: SegmentOption[] = [
  { value: "block", label: "Block", tooltip: "display: block" },
  { value: "flex", label: "Flex", tooltip: "display: flex" },
  { value: "grid", label: "Grid", tooltip: "display: grid" },
  { value: "inline-block", label: "Inline", tooltip: "display: inline-block" },
  { value: "none", label: "None", tooltip: "display: none" },
]

const POSITION_SEGMENTS: SegmentOption[] = [
  { value: "static", label: "Static", tooltip: "position: static" },
  { value: "relative", label: "Relative", tooltip: "position: relative" },
  { value: "absolute", label: "Absolute", tooltip: "position: absolute" },
  { value: "fixed", label: "Fixed", tooltip: "position: fixed" },
  { value: "sticky", label: "Sticky", tooltip: "position: sticky" },
]

const FLEX_DIRECTION_SEGMENTS: SegmentOption[] = [
  {
    value: "row",
    label: "",
    icon: <ArrowRight className="h-3.5 w-3.5" />,
    tooltip: "Row",
  },
  {
    value: "row-reverse",
    label: "",
    icon: <ArrowLeft className="h-3.5 w-3.5" />,
    tooltip: "Row Reverse",
  },
  {
    value: "column",
    label: "",
    icon: <ArrowDown className="h-3.5 w-3.5" />,
    tooltip: "Column",
  },
  {
    value: "column-reverse",
    label: "",
    icon: <ArrowUp className="h-3.5 w-3.5" />,
    tooltip: "Column Reverse",
  },
]

const JUSTIFY_SEGMENTS: SegmentOption[] = [
  {
    value: "flex-start",
    label: "",
    icon: <AlignStartVertical className="h-3.5 w-3.5" />,
    tooltip: "Justify Start",
  },
  {
    value: "center",
    label: "",
    icon: <AlignCenterVertical className="h-3.5 w-3.5" />,
    tooltip: "Justify Center",
  },
  {
    value: "flex-end",
    label: "",
    icon: <AlignEndVertical className="h-3.5 w-3.5" />,
    tooltip: "Justify End",
  },
  {
    value: "space-between",
    label: "",
    icon: <AlignHorizontalSpaceBetween className="h-3.5 w-3.5" />,
    tooltip: "Space Between",
  },
  {
    value: "space-around",
    label: "",
    icon: <AlignHorizontalSpaceAround className="h-3.5 w-3.5" />,
    tooltip: "Space Around",
  },
]

const ALIGN_ITEMS_SEGMENTS: SegmentOption[] = [
  {
    value: "flex-start",
    label: "",
    icon: <AlignStartHorizontal className="h-3.5 w-3.5" />,
    tooltip: "Align Start",
  },
  {
    value: "center",
    label: "",
    icon: <AlignCenterHorizontal className="h-3.5 w-3.5" />,
    tooltip: "Align Center",
  },
  {
    value: "flex-end",
    label: "",
    icon: <AlignEndHorizontal className="h-3.5 w-3.5" />,
    tooltip: "Align End",
  },
  {
    value: "stretch",
    label: "",
    icon: <StretchHorizontal className="h-3.5 w-3.5" />,
    tooltip: "Stretch",
  },
]

const TEXT_ALIGN_SEGMENTS: SegmentOption[] = [
  { value: "left", label: "", icon: <AlignLeft className="h-3.5 w-3.5" />, tooltip: "Align Left" },
  { value: "center", label: "", icon: <AlignCenter className="h-3.5 w-3.5" />, tooltip: "Align Center" },
  { value: "right", label: "", icon: <AlignRight className="h-3.5 w-3.5" />, tooltip: "Align Right" },
  { value: "justify", label: "", icon: <AlignJustify className="h-3.5 w-3.5" />, tooltip: "Justify" },
]

const OVERFLOW_SEGMENTS: SegmentOption[] = [
  { value: "visible", label: "", icon: <Eye className="h-3.5 w-3.5" />, tooltip: "Visible" },
  { value: "hidden", label: "", icon: <EyeOff className="h-3.5 w-3.5" />, tooltip: "Hidden" },
  { value: "scroll", label: "", icon: <ScrollText className="h-3.5 w-3.5" />, tooltip: "Scroll" },
  { value: "auto", label: "Auto", tooltip: "Auto" },
]

const BORDER_STYLE_OPTIONS: DropdownOption[] = [
  { value: "none", label: "None" },
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "double", label: "Double" },
]

const SIZE_PRESETS = [
  { label: "Auto", value: "auto" },
  { label: "Fit", value: "fit-content" },
  { label: "Full", value: "100%" },
  { label: "None", value: "none" },
]

const RADIUS_PRESETS = [
  { label: "0", value: 0 },
  { label: "4", value: 4 },
  { label: "8", value: 8 },
  { label: "12", value: 12 },
  { label: "16", value: 16 },
  { label: "Full", value: 9999 },
]

const SPACING_PRESETS = [
  { label: "0", value: 0 },
  { label: "4", value: 4 },
  { label: "8", value: 8 },
  { label: "12", value: 12 },
  { label: "16", value: 16 },
  { label: "24", value: 24 },
]

const SHADOW_PRESETS = [
  { label: "None", value: "none" },
  { label: "Sm", value: "0 1px 2px rgba(0,0,0,0.1)" },
  { label: "Md", value: "0 4px 8px rgba(0,0,0,0.15)" },
  { label: "Lg", value: "0 10px 24px rgba(0,0,0,0.25)" },
  { label: "XL", value: "0 20px 40px rgba(0,0,0,0.35)" },
]

const STYLE_SECTION_ORDER = ["size", "spacing", "layout", "position", "typography", "colors", "border", "effects", "advanced"]

const PROPERTY_SECTION_ORDER: ElementPropertySection[] = [
  "attributes",
  "link",
  "image",
  "button",
  "field",
  "media",
  "list",
]

const PROPERTY_SECTION_TITLES: Record<ElementPropertySection, string> = {
  attributes: "Attributes",
  link: "Link",
  image: "Image",
  button: "Button",
  field: "Form Field",
  media: "Media",
  list: "List",
}

const STYLE_SECTION_TITLES: Record<string, string> = {
  size: "Size",
  spacing: "Spacing",
  layout: "Layout",
  position: "Position",
  typography: "Typography",
  colors: "Fill & Color",
  border: "Border",
  effects: "Effects",
  advanced: "Advanced",
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  size: <Maximize2 className="h-3.5 w-3.5" />,
  spacing: <Move className="h-3.5 w-3.5" />,
  layout: <Layers className="h-3.5 w-3.5" />,
  position: <Pin className="h-3.5 w-3.5" />,
  typography: <Type className="h-3.5 w-3.5" />,
  colors: <Droplet className="h-3.5 w-3.5" />,
  border: <Square className="h-3.5 w-3.5" />,
  effects: <Sparkles className="h-3.5 w-3.5" />,
  advanced: <Wand2 className="h-3.5 w-3.5" />,
  attributes: <Box className="h-3.5 w-3.5" />,
  link: <Link2 className="h-3.5 w-3.5" />,
  image: <ImageIcon className="h-3.5 w-3.5" />,
  button: <MousePointer2 className="h-3.5 w-3.5" />,
  field: <span className="font-mono text-[10px] font-bold">f(x)</span>,
  media: <span className="font-mono text-[10px] font-bold">▶</span>,
  list: <span className="font-mono text-[10px] font-bold">1.</span>,
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

  const { debounced: debouncedStyleChange, immediate: immediateStyleChange } = useDebounce(onStyleChange, 100)
  const elementChangeHandlers = useDebounce(onElementChange, 200)

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault()
        if (e.shiftKey) onRedo?.()
        else onUndo?.()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault()
        onRedo?.()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onUndo, onRedo])

  // Drag handlers (pointer-events based so drag survives crossing iframes / other elements)
  const activePointerIdRef = useRef<number | null>(null)

  const endDrag = useCallback((target?: HTMLElement | null, pointerId?: number) => {
    setIsDragging(false)
    dragStartRef.current = null
    if (target && pointerId != null) {
      try {
        if (target.hasPointerCapture?.(pointerId)) {
          target.releasePointerCapture(pointerId)
        }
      } catch {
        // ignore
      }
    }
    activePointerIdRef.current = null
  }, [])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest("button, input, select, textarea, [data-no-drag]")) return
      // Only react to primary button for mouse; allow touch/pen as-is.
      if (e.pointerType === "mouse" && e.button !== 0) return
      e.preventDefault()

      const target = e.currentTarget
      try {
        target.setPointerCapture(e.pointerId)
      } catch {
        // ignore - some browsers may throw if pointer is no longer active
      }
      activePointerIdRef.current = e.pointerId

      setIsDragging(true)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y,
      }
    },
    [position]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return
      if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return
      const dx = e.clientX - dragStartRef.current.x
      const dy = e.clientY - dragStartRef.current.y
      const newPos = {
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      }
      setPosition(newPos)
      onPositionChange?.(newPos)
    },
    [onPositionChange]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endDrag(e.currentTarget, e.pointerId)
    },
    [endDrag]
  )

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endDrag(e.currentTarget, e.pointerId)
    },
    [endDrag]
  )

  // Safety net: if the component unmounts mid-drag, reset state.
  useEffect(() => {
    return () => {
      dragStartRef.current = null
      activePointerIdRef.current = null
    }
  }, [])

  // Style change handlers
  const handleStyleChange = useCallback(
    (property: string, value: StyleProperty) => {
      onLiveStyleChange?.(property, value)
      debouncedStyleChange(property, value, true)
    },
    [onLiveStyleChange, debouncedStyleChange]
  )

  const handleImmediateStyleChange = useCallback(
    (property: string, value: StyleProperty) => {
      onLiveStyleChange?.(property, value)
      immediateStyleChange(property, value, true)
    },
    [onLiveStyleChange, immediateStyleChange]
  )

  const resetStyle = useCallback(
    (...properties: string[]) =>
      () => {
        properties.forEach((p) => {
          onLiveStyleChange?.(p, "")
          immediateStyleChange(p, "", true)
        })
      },
    [onLiveStyleChange, immediateStyleChange]
  )

  const handleElementPropertyChange = useCallback(
    (key: string, value: ElementPropertyValue, immediate: boolean = false) => {
      const nextElement: SelectedElement = {
        ...selectedElement,
        properties: {
          ...selectedElement.properties,
          [key]: value,
        },
      }
      if (immediate) elementChangeHandlers.immediate(nextElement)
      else elementChangeHandlers.debounced(nextElement)
    },
    [selectedElement, elementChangeHandlers]
  )

  const handlePropertyChange = useCallback(
    (key: string, value: string) => handleElementPropertyChange(key, value),
    [handleElementPropertyChange]
  )

  const handleBooleanPropertyChange = useCallback(
    (key: string, value: boolean) => handleElementPropertyChange(key, value, true),
    [handleElementPropertyChange]
  )

  const elementTagName = useMemo(() => selectedElement.type.toLowerCase(), [selectedElement.type])

  const visibleSections = useMemo(() => {
    return [...STYLE_SECTION_ORDER, ...getElementPropertySections(elementTagName)]
  }, [elementTagName])

  const propertySections = useMemo(() => {
    return PROPERTY_SECTION_ORDER.reduce<Record<ElementPropertySection, ElementPropertyField[]>>(
      (sections, section) => {
        sections[section] = getElementPropertyFields(elementTagName, section)
        return sections
      },
      {
        attributes: [],
        link: [],
        image: [],
        button: [],
        field: [],
        media: [],
        list: [],
      }
    )
  }, [elementTagName])

  const renderPropertyField = useCallback(
    (field: ElementPropertyField) => {
      const rawValue = selectedElement.properties?.[field.key]
      if (field.control === "boolean") {
        const checked = rawValue === true || rawValue === "true"
        return (
          <StyledToggle
            key={`${field.section}-${field.key}`}
            label={field.label}
            checked={checked}
            onChange={(value) => handleBooleanPropertyChange(field.key, value)}
          />
        )
      }
      if (field.control === "dropdown") {
        return (
          <StyledDropdown
            key={`${field.section}-${field.key}`}
            label={field.label}
            value={rawValue?.toString() || ""}
            onChange={(value) => handleElementPropertyChange(field.key, value, true)}
            options={field.options || []}
          />
        )
      }
      return (
        <StyledTextInput
          key={`${field.section}-${field.key}`}
          label={field.label}
          value={rawValue?.toString() || ""}
          onChange={(value) => handlePropertyChange(field.key, value)}
          placeholder={field.placeholder}
          showValidation={false}
        />
      )
    },
    [
      handleBooleanPropertyChange,
      handleElementPropertyChange,
      handlePropertyChange,
      selectedElement.properties,
    ]
  )

  const display = selectedElement.styles.display?.toString() || ""
  const isFlexLike = display === "flex" || display === "inline-flex"
  const position_ = selectedElement.styles.position?.toString() || ""
  const showOffsets = position_ && position_ !== "static"

  // Section rendering helper
  const renderSection = (key: string, content: React.ReactNode) => (
    <Section
      key={key}
      title={STYLE_SECTION_TITLES[key] || key}
      icon={SECTION_ICONS[key]}
      isExpanded={isExpanded(key)}
      onToggle={() => toggleSection(key)}
    >
      {content}
    </Section>
  )

  return (
    <TooltipProvider delayDuration={250}>
      {/* Full-screen invisible overlay while dragging so the cursor can cross over
          iframes and other elements without losing the pointer stream. */}
      {isDragging && (
        <div
          aria-hidden
          className="fixed inset-0 z-[60]"
          style={{ cursor: "grabbing", touchAction: "none" }}
        />
      )}
      <div
        ref={panelRef}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        className={cn(
          "relative z-[61]",
          "w-[316px] max-h-[640px] flex flex-col overflow-hidden",
          "rounded-xl border border-stone-800/80",
          "bg-stone-950/95 backdrop-blur-xl",
          "shadow-2xl shadow-black/60",
          "ring-1 ring-white/5",
          "animate-in fade-in slide-in-from-right-4 duration-200",
          isDragging && "cursor-grabbing select-none",
          className
        )}
      >
        {/* Compact Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{ touchAction: "none" }}
          className={cn(
            "relative flex items-center gap-2 px-3 py-2.5 border-b border-stone-800/80",
            "bg-gradient-to-b from-stone-900/60 to-transparent",
            isDragging ? "cursor-grabbing" : "cursor-grab"
          )}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-stone-100 text-stone-900 shadow-sm">
              <span className="text-[9px] font-bold uppercase">
                {selectedElement.type.slice(0, 2)}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[12px] font-semibold text-stone-100 leading-tight truncate">
                {selectedElement.type.toLowerCase()}
              </span>
              <span className="text-[9.5px] text-stone-500 leading-tight">Element styles</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5" data-no-drag>
            <IconButton
              icon={<Undo2 className="h-3.5 w-3.5" />}
              tooltip="Undo (⌘Z)"
              size="sm"
              variant="ghost"
              disabled={!canUndo}
              onClick={onUndo}
            />
            <IconButton
              icon={<Redo2 className="h-3.5 w-3.5" />}
              tooltip="Redo (⌘⇧Z)"
              size="sm"
              variant="ghost"
              disabled={!canRedo}
              onClick={onRedo}
            />
            <div className="mx-1 h-4 w-px bg-stone-800" />
            <IconButton
              icon={<X className="h-3.5 w-3.5" />}
              tooltip="Close"
              size="sm"
              variant="ghost"
              onClick={onClose}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-stone-800/80 bg-stone-950/50">
          <button
            type="button"
            onClick={() => expandSections(visibleSections)}
            className="h-5 rounded px-1.5 text-[10px] font-medium text-stone-400 transition-colors hover:bg-stone-800/70 hover:text-stone-100"
          >
            Expand all
          </button>
          <span className="h-3 w-px bg-stone-800" />
          <button
            type="button"
            onClick={collapseAllSections}
            className="h-5 rounded px-1.5 text-[10px] font-medium text-stone-400 transition-colors hover:bg-stone-800/70 hover:text-stone-100"
          >
            Collapse all
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-stone-700 scrollbar-track-transparent">
          {/* Size */}
          {visibleSections.includes("size") &&
            renderSection(
              "size",
              <>
                <DimensionControl
                  label="Width"
                  value={selectedElement.styles.width}
                  property="width"
                  onLiveChange={handleStyleChange}
                  onCommit={handleImmediateStyleChange}
                  onReset={resetStyle("width")}
                  presets={SIZE_PRESETS}
                />
                <DimensionControl
                  label="Height"
                  value={selectedElement.styles.height}
                  property="height"
                  onLiveChange={handleStyleChange}
                  onCommit={handleImmediateStyleChange}
                  onReset={resetStyle("height")}
                  presets={SIZE_PRESETS}
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <DimensionControl
                    label="Min W"
                    value={selectedElement.styles.minWidth}
                    property="minWidth"
                    onLiveChange={handleStyleChange}
                    onCommit={handleImmediateStyleChange}
                    onReset={resetStyle("minWidth")}
                  />
                  <DimensionControl
                    label="Max W"
                    value={selectedElement.styles.maxWidth}
                    property="maxWidth"
                    onLiveChange={handleStyleChange}
                    onCommit={handleImmediateStyleChange}
                    onReset={resetStyle("maxWidth")}
                  />
                </div>
              </>
            )}

          {/* Spacing */}
          {visibleSections.includes("spacing") &&
            renderSection(
              "spacing",
              <>
                <BoxModelControl
                  property="margin"
                  styles={selectedElement.styles}
                  onLiveChange={handleStyleChange}
                  onCommit={handleImmediateStyleChange}
                />
                <PresetChips
                  label="Margin presets"
                  values={SPACING_PRESETS}
                  onSelect={(v) => {
                    const value = toCssLength(Number(v))
                    ;["marginTop", "marginRight", "marginBottom", "marginLeft"].forEach((p) =>
                      handleImmediateStyleChange(p, value)
                    )
                  }}
                />
                <div className="h-px bg-stone-800/60" />
                <BoxModelControl
                  property="padding"
                  styles={selectedElement.styles}
                  onLiveChange={handleStyleChange}
                  onCommit={handleImmediateStyleChange}
                />
                <PresetChips
                  label="Padding presets"
                  values={SPACING_PRESETS}
                  onSelect={(v) => {
                    const value = toCssLength(Number(v))
                    ;["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].forEach((p) =>
                      handleImmediateStyleChange(p, value)
                    )
                  }}
                />
              </>
            )}

          {/* Layout */}
          {visibleSections.includes("layout") &&
            renderSection(
              "layout",
              <>
                <SegmentedControl
                  label="Display"
                  value={display}
                  options={DISPLAY_SEGMENTS}
                  onChange={(v) => handleImmediateStyleChange("display", v)}
                  onReset={resetStyle("display")}
                />
                {isFlexLike && (
                  <>
                    <SegmentedControl
                      label="Direction"
                      value={selectedElement.styles.flexDirection?.toString() || ""}
                      options={FLEX_DIRECTION_SEGMENTS}
                      onChange={(v) => handleImmediateStyleChange("flexDirection", v)}
                      onReset={resetStyle("flexDirection")}
                    />
                    <SegmentedControl
                      label="Justify Content"
                      value={selectedElement.styles.justifyContent?.toString() || ""}
                      options={JUSTIFY_SEGMENTS}
                      onChange={(v) => handleImmediateStyleChange("justifyContent", v)}
                      onReset={resetStyle("justifyContent")}
                    />
                    <SegmentedControl
                      label="Align Items"
                      value={selectedElement.styles.alignItems?.toString() || ""}
                      options={ALIGN_ITEMS_SEGMENTS}
                      onChange={(v) => handleImmediateStyleChange("alignItems", v)}
                      onReset={resetStyle("alignItems")}
                    />
                    <DimensionControl
                      label="Gap"
                      value={selectedElement.styles.gap}
                      property="gap"
                      onLiveChange={handleStyleChange}
                      onCommit={handleImmediateStyleChange}
                      onReset={resetStyle("gap")}
                      showSlider
                      sliderMax={120}
                    />
                  </>
                )}
              </>
            )}

          {/* Position */}
          {visibleSections.includes("position") &&
            renderSection(
              "position",
              <>
                <SegmentedControl
                  label="Position"
                  value={position_}
                  options={POSITION_SEGMENTS}
                  onChange={(v) => handleImmediateStyleChange("position", v)}
                  onReset={resetStyle("position", "top", "right", "bottom", "left")}
                />
                {showOffsets && (
                  <PositionOffsetControl
                    styles={selectedElement.styles}
                    onLiveChange={handleStyleChange}
                    onCommit={handleImmediateStyleChange}
                  />
                )}
                <NumberInput
                  label="Z-Index"
                  value={extractNumericValue(selectedElement.styles.zIndex, 0)}
                  onChange={(n) => handleStyleChange("zIndex", n)}
                  onCommit={(n) => handleImmediateStyleChange("zIndex", n)}
                  onReset={resetStyle("zIndex")}
                  defaultValue={0}
                  step={1}
                />
              </>
            )}

          {/* Typography */}
          {visibleSections.includes("typography") &&
            renderSection(
              "typography",
              <>
                <StyledDropdown
                  label="Font Family"
                  value={selectedElement.styles.fontFamily?.toString() || ""}
                  onChange={(v) => handleImmediateStyleChange("fontFamily", v)}
                  onReset={resetStyle("fontFamily")}
                  options={FONT_FAMILY_OPTIONS}
                />
                <DimensionControl
                  label="Font Size"
                  value={selectedElement.styles.fontSize}
                  property="fontSize"
                  onLiveChange={handleStyleChange}
                  onCommit={handleImmediateStyleChange}
                  onReset={resetStyle("fontSize")}
                  showSlider
                  sliderMax={96}
                />
                <SegmentedControl
                  label="Font Weight"
                  value={selectedElement.styles.fontWeight?.toString() || ""}
                  options={FONT_WEIGHT_OPTIONS}
                  onChange={(v) => handleImmediateStyleChange("fontWeight", v)}
                  onReset={resetStyle("fontWeight")}
                  size="sm"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <NumberInput
                    label="Line H"
                    value={extractNumericValue(selectedElement.styles.lineHeight, 1.5)}
                    onChange={(n) => handleStyleChange("lineHeight", n.toString())}
                    onCommit={(n) => handleImmediateStyleChange("lineHeight", n.toString())}
                    onReset={resetStyle("lineHeight")}
                    defaultValue={1.5}
                    step={0.1}
                    min={0}
                    max={5}
                  />
                  <DimensionControl
                    label="Letter"
                    value={selectedElement.styles.letterSpacing}
                    property="letterSpacing"
                    onLiveChange={handleStyleChange}
                    onCommit={handleImmediateStyleChange}
                    onReset={resetStyle("letterSpacing")}
                    showStepper
                  />
                </div>
                <SegmentedControl
                  label="Text Align"
                  value={selectedElement.styles.textAlign?.toString() || ""}
                  options={TEXT_ALIGN_SEGMENTS}
                  onChange={(v) => handleImmediateStyleChange("textAlign", v)}
                  onReset={resetStyle("textAlign")}
                />
              </>
            )}

          {/* Colors */}
          {visibleSections.includes("colors") &&
            renderSection(
              "colors",
              <>
                <ColorInput
                  label="Text"
                  value={selectedElement.styles.color?.toString() || ""}
                  onChange={(v) => handleStyleChange("color", v)}
                  onImmediateChange={(v) => handleImmediateStyleChange("color", v)}
                  onReset={resetStyle("color")}
                  property="color"
                />
                <ColorInput
                  label="Background"
                  value={selectedElement.styles.backgroundColor?.toString() || ""}
                  onChange={(v) => handleStyleChange("backgroundColor", v)}
                  onImmediateChange={(v) => handleImmediateStyleChange("backgroundColor", v)}
                  onReset={resetStyle("backgroundColor")}
                  property="backgroundColor"
                />
              </>
            )}

          {/* Border */}
          {visibleSections.includes("border") &&
            renderSection(
              "border",
              <>
                <div className="grid grid-cols-2 gap-2.5">
                  <DimensionControl
                    label="Width"
                    value={selectedElement.styles.borderWidth}
                    property="borderWidth"
                    onLiveChange={handleStyleChange}
                    onCommit={handleImmediateStyleChange}
                    onReset={resetStyle("borderWidth")}
                  />
                  <StyledDropdown
                    label="Style"
                    value={selectedElement.styles.borderStyle?.toString() || ""}
                    onChange={(v) => handleImmediateStyleChange("borderStyle", v)}
                    onReset={resetStyle("borderStyle")}
                    options={BORDER_STYLE_OPTIONS}
                  />
                </div>
                <ColorInput
                  label="Color"
                  value={selectedElement.styles.borderColor?.toString() || ""}
                  onChange={(v) => handleStyleChange("borderColor", v)}
                  onImmediateChange={(v) => handleImmediateStyleChange("borderColor", v)}
                  onReset={resetStyle("borderColor")}
                  property="borderColor"
                />
                <DimensionControl
                  label="Radius"
                  value={selectedElement.styles.borderRadius}
                  property="borderRadius"
                  onLiveChange={handleStyleChange}
                  onCommit={handleImmediateStyleChange}
                  onReset={resetStyle("borderRadius")}
                  showSlider
                  sliderMax={64}
                  presets={RADIUS_PRESETS.map((p) => ({ label: p.label, value: toCssLength(Number(p.value)) }))}
                />
              </>
            )}

          {/* Effects */}
          {visibleSections.includes("effects") &&
            renderSection(
              "effects",
              <>
                <Slider
                  label="Opacity"
                  value={parseFloat(selectedElement.styles.opacity?.toString() || "1") * 100}
                  onChange={(v) => handleStyleChange("opacity", (v / 100).toString())}
                  onChangeComplete={(v) => handleImmediateStyleChange("opacity", (v / 100).toString())}
                  onReset={resetStyle("opacity")}
                  defaultValue={100}
                  min={0}
                  max={100}
                  unit="%"
                />
                <SubGroup label="Box Shadow">
                  <PresetChips
                    values={SHADOW_PRESETS}
                    activeValue={selectedElement.styles.boxShadow?.toString()}
                    onSelect={(v) => handleImmediateStyleChange("boxShadow", v as string)}
                  />
                </SubGroup>
                <StyledTextArea
                  label="Custom Shadow"
                  value={selectedElement.styles.boxShadow?.toString() || ""}
                  onChange={(v) => handleStyleChange("boxShadow", v)}
                  onReset={resetStyle("boxShadow")}
                  placeholder="0 4px 12px rgba(0,0,0,0.3)"
                />
              </>
            )}

          {/* Advanced (Overflow + custom) */}
          {visibleSections.includes("advanced") &&
            renderSection(
              "advanced",
              <>
                <SegmentedControl
                  label="Overflow"
                  value={selectedElement.styles.overflow?.toString() || ""}
                  options={OVERFLOW_SEGMENTS}
                  onChange={(v) => handleImmediateStyleChange("overflow", v)}
                  onReset={resetStyle("overflow")}
                />
                <StyledTextInput
                  label="Cursor"
                  value={selectedElement.styles.cursor?.toString() || ""}
                  onChange={(v) => handleStyleChange("cursor", v)}
                  onImmediateChange={(v) => handleImmediateStyleChange("cursor", v)}
                  onReset={resetStyle("cursor")}
                  placeholder="auto, pointer, text..."
                  showValidation={false}
                />
                <StyledTextInput
                  label="Transition"
                  value={selectedElement.styles.transition?.toString() || ""}
                  onChange={(v) => handleStyleChange("transition", v)}
                  onImmediateChange={(v) => handleImmediateStyleChange("transition", v)}
                  onReset={resetStyle("transition")}
                  placeholder="all 200ms ease"
                  showValidation={false}
                />
              </>
            )}

          {/* Element-specific property sections */}
          {PROPERTY_SECTION_ORDER.map((section) => {
            const fields = propertySections[section]
            if (!visibleSections.includes(section) || fields.length === 0) return null
            return (
              <Section
                key={section}
                title={PROPERTY_SECTION_TITLES[section]}
                icon={SECTION_ICONS[section]}
                isExpanded={isExpanded(section)}
                onToggle={() => toggleSection(section)}
              >
                {fields.map(renderPropertyField)}
              </Section>
            )
          })}

          <div className="h-2" />
        </div>
      </div>
    </TooltipProvider>
  )
}
