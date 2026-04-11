"use client"

import { useRef, useCallback, useEffect, useState } from "react"
import Editor, { loader } from "@monaco-editor/react"
import type { OnMount, BeforeMount } from "@monaco-editor/react"
import type { editor } from "monaco-editor"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useEditor } from "@/stores/editor-store"

const createEditorWorker = () =>
  new Worker(new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url), {
    type: "module",
  })

const createJsonWorker = () =>
  new Worker(new URL("monaco-editor/esm/vs/language/json/json.worker.js", import.meta.url), {
    type: "module",
  })

const createCssWorker = () =>
  new Worker(new URL("monaco-editor/esm/vs/language/css/css.worker.js", import.meta.url), {
    type: "module",
  })

const createHtmlWorker = () =>
  new Worker(new URL("monaco-editor/esm/vs/language/html/html.worker.js", import.meta.url), {
    type: "module",
  })

const createTypeScriptWorker = () =>
  new Worker(new URL("monaco-editor/esm/vs/language/typescript/ts.worker.js", import.meta.url), {
    type: "module",
  })

const monacoEnvironment = globalThis as typeof globalThis & {
  MonacoEnvironment?: {
    getWorker?: (_moduleId: string, label: string) => Worker
  }
}

let monacoSetupPromise: Promise<void> | null = null
let monacoConfigured = false

function ensureMonacoConfigured(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve()
  }

  if (monacoConfigured) {
    return Promise.resolve()
  }

  if (!monacoSetupPromise) {
    monacoSetupPromise = import("monaco-editor").then((monacoModule) => {
      monacoEnvironment.MonacoEnvironment = {
        ...monacoEnvironment.MonacoEnvironment,
        getWorker(_moduleId, label) {
          switch (label) {
            case "json":
              return createJsonWorker()
            case "css":
            case "scss":
            case "less":
              return createCssWorker()
            case "html":
            case "handlebars":
            case "razor":
              return createHtmlWorker()
            case "typescript":
            case "javascript":
              return createTypeScriptWorker()
            default:
              return createEditorWorker()
          }
        },
      }

      loader.config({ monaco: monacoModule })
      monacoConfigured = true
    })
  }

  return monacoSetupPromise
}

interface CodeEditorProps {
  value: string
  onChange?: (value: string) => void
  language?: string
  readOnly?: boolean
  className?: string
  modelPath?: string
}

export function CodeEditor({
  value,
  onChange,
  language = "html",
  readOnly = false,
  className,
  modelPath = "/project/index.html",
}: CodeEditorProps) {
  const { state } = useEditor()
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const blurDisposableRef = useRef<{ dispose(): void } | null>(null)
  const isProgrammaticSyncRef = useRef(false)
  const onChangeRef = useRef(onChange)
  const valueRef = useRef(value)
  const [isMonacoReady, setIsMonacoReady] = useState(() => typeof window !== "undefined" && monacoConfigured)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    let cancelled = false

    void ensureMonacoConfigured()
      .then(() => {
        if (!cancelled) {
          setIsMonacoReady(true)
        }
      })
      .catch((error) => {
        console.error("Failed to configure Monaco", error)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason as { message?: string; stack?: string } | undefined
      const message = reason?.message || ""
      const stack = reason?.stack || ""

      if (message === "Canceled" && stack.includes("monaco-editor")) {
        event.preventDefault()
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection)

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection)
    }
  }, [])

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

  const flushEditorValue = useCallback(() => {
    if (isProgrammaticSyncRef.current) {
      return
    }

    const nextValue = editorRef.current?.getModel()?.getValue()
    if (nextValue === undefined || nextValue === valueRef.current) {
      return
    }

    valueRef.current = nextValue
    onChangeRef.current?.(nextValue)
  }, [])

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor
    blurDisposableRef.current?.dispose()
    blurDisposableRef.current = editor.onDidBlurEditorText(() => {
      flushEditorValue()
    })

    // Sync value on mount — keepCurrentModel may load a stale cached model
    const model = editor.getModel()
    if (model && model.getValue() !== valueRef.current) {
      isProgrammaticSyncRef.current = true
      const selection = editor.getSelection()
      const scrollTop = editor.getScrollTop()
      model.setValue(valueRef.current)
      if (selection) editor.setSelection(selection)
      editor.setScrollTop(scrollTop)
      queueMicrotask(() => {
        isProgrammaticSyncRef.current = false
      })
    }

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
  }, [flushEditorValue])

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (isProgrammaticSyncRef.current) {
        return
      }

      if (onChange && value !== undefined) {
        onChange(value)
      }
    },
    [onChange]
  )

  useEffect(() => {
    const editorInstance = editorRef.current
    const model = editorInstance?.getModel()

    if (!editorInstance || !model) {
      return
    }

    if (model.getValue() === value) {
      return
    }

    isProgrammaticSyncRef.current = true

    const selection = editorInstance.getSelection()
    const scrollTop = editorInstance.getScrollTop()
    const scrollLeft = editorInstance.getScrollLeft()

    model.setValue(value)

    if (selection) {
      editorInstance.setSelection(selection)
    }

    editorInstance.setScrollTop(scrollTop)
    editorInstance.setScrollLeft(scrollLeft)

    queueMicrotask(() => {
      isProgrammaticSyncRef.current = false
    })
  }, [value])

  useEffect(() => {
    return () => {
      flushEditorValue()
      blurDisposableRef.current?.dispose()
      blurDisposableRef.current = null
      editorRef.current = null
    }
  }, [flushEditorValue])

  return (
    <div className={cn("w-full h-full", className)}>
      {!isMonacoReady ? (
        <div className="flex items-center justify-center h-full bg-zinc-950">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
        </div>
      ) : (
      <Editor
        height="100%"
        defaultLanguage={language}
        path={modelPath}
        value={value}
        onChange={handleEditorChange}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        keepCurrentModel
        saveViewState
        theme="codeui-dark"
        loading={
          <div className="flex items-center justify-center h-full bg-zinc-950">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        }
        options={{
          readOnly: readOnly || state.isApplyingPatch,
          minimap: { enabled: true, scale: 1 },
          fontSize: 13,
          fontFamily: "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
          lineNumbers: "on",
          wordWrap: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 16, bottom: 16 },
          smoothScrolling: false,
          cursorBlinking: "solid",
          cursorSmoothCaretAnimation: "off",
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
          selectionHighlight: false,
          occurrencesHighlight: "off",
        }}
      />
      )}
    </div>
  )
}
