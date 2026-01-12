"use client"

import { useRef, useCallback } from "react"
import Editor, { OnMount, BeforeMount, Monaco } from "@monaco-editor/react"
import type { editor, IPosition } from "monaco-editor"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  className?: string
}

export function CodeEditor({
  value,
  onChange,
  language = "html",
  readOnly = false,
  className,
}: CodeEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  const handleBeforeMount: BeforeMount = useCallback((monaco) => {
    // Define custom dark theme
    monaco.editor.defineTheme("codeui-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6A9955", fontStyle: "italic" },
        { token: "keyword", foreground: "569CD6" },
        { token: "string", foreground: "CE9178" },
        { token: "number", foreground: "B5CEA8" },
        { token: "tag", foreground: "569CD6" },
        { token: "attribute.name", foreground: "9CDCFE" },
        { token: "attribute.value", foreground: "CE9178" },
        { token: "delimiter.html", foreground: "808080" },
        { token: "metatag.html", foreground: "569CD6" },
        { token: "metatag.content.html", foreground: "9CDCFE" },
      ],
      colors: {
        "editor.background": "#0a0a0a",
        "editor.foreground": "#d4d4d4",
        "editor.lineHighlightBackground": "#1a1a1a",
        "editor.selectionBackground": "#264f78",
        "editor.inactiveSelectionBackground": "#3a3d41",
        "editorCursor.foreground": "#aeafad",
        "editorWhitespace.foreground": "#3b3a32",
        "editorIndentGuide.background": "#404040",
        "editorIndentGuide.activeBackground": "#707070",
        "editor.lineHighlightBorder": "#282828",
        "editorLineNumber.foreground": "#5a5a5a",
        "editorLineNumber.activeForeground": "#c6c6c6",
        "editorGutter.background": "#0a0a0a",
        "scrollbarSlider.background": "#4e4e4e50",
        "scrollbarSlider.hoverBackground": "#64646480",
        "scrollbarSlider.activeBackground": "#80808090",
      },
    })
  }, [])

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    // Enable Emmet for HTML - Tailwind CSS class suggestions
    monaco.languages.registerCompletionItemProvider("html", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position)
        const range = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        }

        // Tailwind CSS class suggestions
        const tailwindClasses = [
          "flex", "grid", "block", "inline", "hidden",
          "items-center", "justify-center", "justify-between",
          "p-4", "px-4", "py-4", "m-4", "mx-auto", "my-4",
          "w-full", "h-full", "min-h-screen",
          "bg-white", "bg-gray-100", "bg-blue-500",
          "text-white", "text-gray-900", "text-sm", "text-lg", "text-xl",
          "font-bold", "font-semibold", "font-medium",
          "rounded", "rounded-lg", "rounded-full",
          "shadow", "shadow-lg", "shadow-xl",
          "border", "border-gray-200", "border-gray-300",
          "hover:bg-blue-600", "hover:text-white",
          "transition", "transition-colors", "duration-200",
          "container", "mx-auto", "max-w-7xl",
          "space-y-4", "space-x-4", "gap-4",
        ]

        return {
          suggestions: tailwindClasses.map((className) => ({
            label: className,
            kind: monaco.languages.CompletionItemKind.Value,
            insertText: className,
            range,
          })),
        }
      },
    })

    // Format on paste
    editor.getModel()?.updateOptions({ tabSize: 2 })
  }, [])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (onChange && value !== undefined) {
        onChange(value)
      }
    },
    [onChange]
  )

  return (
    <div className={cn("w-full h-full", className)}>
      <Editor
        height="100%"
        defaultLanguage={language}
        value={value}
        onChange={handleEditorChange}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        theme="codeui-dark"
        loading={
          <div className="flex items-center justify-center h-full bg-zinc-950">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: true, scale: 1 },
          fontSize: 13,
          fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          renderWhitespace: "selection",
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            indentation: true,
          },
          suggest: {
            showKeywords: true,
            showSnippets: true,
          },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          insertSpaces: true,
          folding: true,
          foldingStrategy: "indentation",
          showFoldingControls: "mouseover",
          links: true,
          colorDecorators: true,
        }}
      />
    </div>
  )
}
