import { Bookmark } from "lucide-react"

const chatMessages = [
  { id: 1, label: "index" },
  { id: 2, label: "prompts" },
  { id: 3, label: "settings" },
  { id: 4, label: "api" },
  { id: 5, label: "docs" },
]

export function Sidebar() {
  return (
    <div className="py-2">
      {chatMessages.map((item) => (
        <div key={item.id} className="group">
          <div className="px-4 py-1.5 text-xs text-zinc-700 select-none font-mono">//</div>
          <div className="mx-2 px-3 py-2.5 flex items-center justify-between hover:bg-zinc-800/50 rounded-md cursor-pointer transition-colors">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-zinc-800 rounded-md text-xs text-zinc-400 font-medium">{item.label}</span>
            </div>
            <Bookmark className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
          </div>
        </div>
      ))}
      <div className="px-4 py-1.5 text-xs text-zinc-700 select-none font-mono">//</div>
    </div>
  )
}
