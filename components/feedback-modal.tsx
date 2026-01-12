"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { 
  Bug, 
  Lightbulb, 
  MessageSquare, 
  CheckCircle2,
  Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"

type FeedbackType = "bug" | "feature" | "general"

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

export function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const [type, setType] = React.useState<FeedbackType>("general")
  const [message, setMessage] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsSubmitting(true)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    setIsSubmitting(false)
    setIsSuccess(true)
    
    // Reset and close after success
    setTimeout(() => {
      setIsSuccess(false)
      setMessage("")
      setType("general")
      onClose()
    }, 2000)
  }

  const feedbackTypes = [
    {
      id: "general" as FeedbackType,
      label: "General",
      icon: MessageSquare,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20"
    },
    {
      id: "bug" as FeedbackType,
      label: "Bug Report",
      icon: Bug,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    },
    {
      id: "feature" as FeedbackType,
      label: "Feature Request",
      icon: Lightbulb,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20"
    }
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px] bg-zinc-950 border-white/10 text-zinc-100 p-0 overflow-hidden">
        {isSuccess ? (
          <div className="py-12 flex flex-col items-center justify-center text-center px-6">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Thank you!</h3>
            <p className="text-sm text-zinc-400">
              Your feedback helps us make CodeUI better for everyone.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader className="p-6 pb-2 text-left">
              <DialogTitle className="text-xl font-bold tracking-tight">Share Feedback</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Let us know what's on your mind. We're always listening!
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-4 space-y-6">
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Feedback Type
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {feedbackTypes.map((item) => {
                    const Icon = item.icon
                    const isSelected = type === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setType(item.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200",
                          isSelected 
                            ? cn("bg-zinc-900 border-white/20 ring-1 ring-white/10") 
                            : "bg-transparent border-white/5 hover:bg-zinc-900/50 hover:border-white/10"
                        )}
                      >
                        <div className={cn("p-2 rounded-lg", item.bg)}>
                          <Icon className={cn("w-4 h-4", item.color)} />
                        </div>
                        <span className={cn(
                          "text-[10px] font-medium",
                          isSelected ? "text-white" : "text-zinc-500"
                        )}>
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <Label htmlFor="message" className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  Your Message
                </Label>
                <Textarea
                  id="message"
                  placeholder="Describe your feedback..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[120px] bg-zinc-900 border-white/10 focus:border-white/20 focus:ring-0 resize-none text-sm placeholder:text-zinc-600"
                  required
                />
              </div>
            </div>

            <DialogFooter className="p-6 pt-2">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={onClose}
                className="text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting || !message.trim()}
                className="bg-white text-black hover:bg-zinc-200 min-w-[100px]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Feedback"
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
