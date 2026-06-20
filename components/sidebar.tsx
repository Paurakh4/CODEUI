import { FileText } from "lucide-react"

const chatMessages = [
  { id: 1, label: "index" },
  { id: 2, label: "prompts" },
  { id: 3, label: "settings" },
  { id: 4, label: "api" },
  { id: 5, label: "docs" },
]

export function Sidebar() {
  return (
    <div className="py-3">
      <div className="px-4 pb-2 flex items-center gap-2">
        <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-zinc-600">Files</span>
      </div>
      {chatMessages.map((item) => (
        <div key={item.id} className="group">
          <div className="mx-2 px-3 py-2 flex items-center gap-3 hover:bg-white/[0.04] rounded-md cursor-pointer transition-colors">
            <FileText className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
            <span className="text-[13px] text-zinc-400 group-hover:text-zinc-200 transition-colors font-medium">{item.label}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
