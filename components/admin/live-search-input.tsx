"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

interface LiveSearchInputProps {
  paramName: string
  placeholder: string
  defaultValue?: string
  basePath: string
  preserveParams?: string[]
  className?: string
}

export function LiveSearchInput({
  paramName,
  placeholder,
  defaultValue = "",
  basePath,
  preserveParams = [],
  className,
}: LiveSearchInputProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(defaultValue)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setValue(defaultValue)
  }, [defaultValue])

  const updateUrl = (query: string) => {
    const params = new URLSearchParams()
    preserveParams.forEach((key) => {
      const current = searchParams.get(key)
      if (current) params.set(key, current)
    })
    if (query.trim()) {
      params.set(paramName, query.trim())
    }
    const queryString = params.toString()
    router.push(queryString ? `${basePath}?${queryString}` : basePath)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      updateUrl(newValue)
    }, 300)
  }

  const handleClear = () => {
    setValue("")
    updateUrl("")
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9B9B9F]" />
      <input
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-white/[0.04] bg-[#0E0E10] pl-9 pr-8 text-sm text-[#E7E7E9] placeholder:text-[#9B9B9F]/50 focus:outline-none focus:ring-2 focus:ring-white/10"
      />
      {value ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9B9B9F] transition-colors hover:text-[#E7E7E9]"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
