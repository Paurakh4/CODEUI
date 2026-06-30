"use client"

interface AutoSubmitSelectProps {
  name: string
  defaultValue: string
  className?: string
  children: React.ReactNode
}

export function AutoSubmitSelect({
  name,
  defaultValue,
  className,
  children,
}: AutoSubmitSelectProps) {
  return (
    <select
      name={name}
      defaultValue={defaultValue}
      onChange={(e) => e.target.form?.submit()}
      className={className}
    >
      {children}
    </select>
  )
}
