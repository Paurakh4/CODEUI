"use client";

import { ArrowRight, Bot, Check, ChevronDown, Loader2, Paperclip, Sparkles, X } from "lucide-react";
import { useState, useRef, useCallback, useEffect, type ChangeEvent, type DragEvent } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CODEUI_GOD_MODE_MODEL_ID, isVisionCapableModel } from "@/lib/ai-models";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "@/components/ui/no-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ponytail: image payload caps — large data URLs bloat Mongo docs; upgrade path = upload to media library + store URL
const MAX_IMAGES_PER_MESSAGE = 4
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB
const IMAGE_DOWNSCALE_MAX_DIM = 1024 // px — keeps data URLs sane

interface AttachedImage {
    id: string
    dataUrl: string
    name: string
}

function generateImageId() {
    return `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Downscale an image to fit within maxDim × maxDim via an offscreen canvas.
 * Preserves aspect ratio. Returns a data URL (JPEG 0.85 quality).
 */
function downscaleImage(file: File, maxDim: number): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            const img = new Image()
            img.onload = () => {
                let { width, height } = img
                if (width <= maxDim && height <= maxDim) {
                    // No downscale needed — return the original data URL
                    resolve(reader.result as string)
                    return
                }
                const ratio = Math.min(maxDim / width, maxDim / height)
                width = Math.round(width * ratio)
                height = Math.round(height * ratio)
                const canvas = document.createElement("canvas")
                canvas.width = width
                canvas.height = height
                const ctx = canvas.getContext("2d")
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"))
                    return
                }
                ctx.drawImage(img, 0, 0, width, height)
                resolve(canvas.toDataURL("image/jpeg", 0.85))
            }
            img.onerror = () => reject(new Error("Failed to load image for downscale"))
            img.src = reader.result as string
        }
        reader.onerror = () => reject(new Error("Failed to read file"))
        reader.readAsDataURL(file)
    })
}

interface UseAutoResizeTextareaProps {
    minHeight: number;
    maxHeight?: number;
}

function useAutoResizeTextarea({
    minHeight,
    maxHeight,
}: UseAutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(
        (reset?: boolean) => {
            const textarea = textareaRef.current;
            if (!textarea) return;

            if (reset) {
                textarea.style.height = `${minHeight}px`;
                return;
            }

            textarea.style.height = `${minHeight}px`;

            const newHeight = Math.max(
                minHeight,
                Math.min(
                    textarea.scrollHeight,
                    maxHeight ?? Number.POSITIVE_INFINITY
                )
            );

            textarea.style.height = `${newHeight}px`;
        },
        [minHeight, maxHeight]
    );

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = `${minHeight}px`;
        }
    }, [minHeight]);

    useEffect(() => {
        const handleResize = () => adjustHeight();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [adjustHeight]);

    return { textareaRef, adjustHeight };
}

interface AI_PromptProps {
    onSend?: (message: string, model?: string, images?: Array<{ dataUrl: string }>) => void;
    onEnhance?: (message: string, model?: string) => Promise<string>;
    onDraftChange?: (message: string) => void;
    onCancel?: () => void;
    initialModelId?: string;
    onModelChange?: (modelId: string) => void;
    availableModels?: Array<{ id: string, name: string }>;
    isLoadingModels?: boolean;
    isGenerating?: boolean;
    /** Single-slot queued prompt shown while generating (Bug #5). */
    queuedPrompt?: string | null;
    /** Cancel the queued prompt. */
    onCancelQueued?: () => void;
}

export function AI_Prompt({
    onSend,
    onEnhance,
    onDraftChange,
    onCancel,
    initialModelId,
    onModelChange,
    availableModels: propAvailableModels,
    isLoadingModels: propIsLoadingModels,
    isGenerating = false,
    queuedPrompt,
    onCancelQueued,
}: AI_PromptProps) {
    const [value, setValue] = useState("");
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
    const [isDraggingOver, setIsDraggingOver] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { textareaRef, adjustHeight } = useAutoResizeTextarea({
        minHeight: 52,
        maxHeight: 100,
    });

    // State for models
    const [selectedModelId, setSelectedModelId] = useState(initialModelId || CODEUI_GOD_MODE_MODEL_ID);
    const [localAvailableModels, setLocalAvailableModels] = useState<Array<{ id: string, name: string }>>([]);
    const [localIsLoadingModels, setLocalIsLoadingModels] = useState(true);

    const availableModels = propAvailableModels || localAvailableModels;
    const isLoadingModels = propIsLoadingModels !== undefined ? propIsLoadingModels : localIsLoadingModels;

    // Sync state with prop
    useEffect(() => {
        if (initialModelId) {
            setSelectedModelId(initialModelId);
        }
    }, [initialModelId]);

    useEffect(() => {
        if (onModelChange) {
            onModelChange(selectedModelId);
        }
    }, [selectedModelId, onModelChange]);

    useEffect(() => {
        onDraftChange?.(value);
    }, [onDraftChange, value]);

    // Fetch available models on mount only if props are not provided
    useEffect(() => {
        if (propAvailableModels) return;

        fetch('/api/ai/models')
            .then(res => res.json())
            .then(data => {
                if (data.models && Array.isArray(data.models)) {
                    const models = data.models.map((m: any) => ({ id: m.id, name: m.name }));
                    const defaultModelId =
                        typeof data.defaultModelId === "string" &&
                            models.some((model: { id: string }) => model.id === data.defaultModelId)
                            ? data.defaultModelId
                            : undefined;
                    setLocalAvailableModels(models);

                    if (models.length > 0 && !initialModelId) {
                        setSelectedModelId((currentModelId) => {
                            if (defaultModelId) {
                                return defaultModelId;
                            }

                            if (models.some((m: { id: string }) => m.id === currentModelId)) {
                                return currentModelId;
                            }

                            return models[0].id;
                        });
                    }
                }
            })
            .catch(err => {
                console.error('Failed to fetch models:', err);
                // Fallback to default models
                setLocalAvailableModels([
                    { id: CODEUI_GOD_MODE_MODEL_ID, name: "Gemini 3 Flash Preview" },
                    { id: "deepseek/deepseek-chat", name: "DeepSeek V3" },
                    { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
                ]);
            })
            .finally(() => {
                setLocalIsLoadingModels(false);
            });
    }, [propAvailableModels, initialModelId]);

    const addFiles = useCallback(async (files: FileList | File[]) => {
        if (!isVisionCapableModel(selectedModelId)) {
            // ponytail: block image attach when model doesn't support vision — prevents the send-time error
            return
        }

        const imageFiles: File[] = []
        for (let i = 0; i < files.length; i += 1) {
            const file = files[i]
            if (!file.type.startsWith("image/")) continue
            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                // ponytail: toast not available in this component; caller can observe via onSend
                console.warn(`Image "${file.name}" exceeds ${MAX_IMAGE_SIZE_BYTES / 1024 / 1024} MB limit, skipping`)
                continue
            }
            imageFiles.push(file)
        }

        const remaining = MAX_IMAGES_PER_MESSAGE - attachedImages.length
        const toAdd = imageFiles.slice(0, remaining)

        const newImages: AttachedImage[] = await Promise.all(
            toAdd.map(async (file) => ({
                id: generateImageId(),
                dataUrl: await downscaleImage(file, IMAGE_DOWNSCALE_MAX_DIM),
                name: file.name,
            }))
        )

        setAttachedImages((prev) => [...prev, ...newImages].slice(0, MAX_IMAGES_PER_MESSAGE))

        // Reset file input so the same file can be re-selected
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }, [attachedImages.length, selectedModelId])

    const removeImage = useCallback((id: string) => {
        setAttachedImages((prev) => prev.filter((img) => img.id !== id))
    }, [])

    const handleSubmit = useCallback(() => {
        if (!value.trim() || isEnhancing) return;
        const images = attachedImages.map((img) => ({ dataUrl: img.dataUrl }))
        // ponytail: allow sending while generating — parent handles queuing (Bug #5).
        onSend?.(value.trim(), selectedModelId, images);
        setValue("");
        setAttachedImages([]);
        adjustHeight(true);
    }, [value, isEnhancing, attachedImages, selectedModelId, onSend, adjustHeight])

    const handleEnhance = async () => {
        if (!onEnhance || !value.trim() || isEnhancing) {
            return;
        }

        setIsEnhancing(true);

        try {
            const enhancedPrompt = await onEnhance(value.trim(), selectedModelId);

            if (!enhancedPrompt || !enhancedPrompt.trim()) {
                return;
            }

            setValue(enhancedPrompt.trim());
            window.requestAnimationFrame(() => {
                adjustHeight();
            });
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key !== "Enter" || e.shiftKey) return;

        e.preventDefault();

        if (isEnhancing) {
            return;
        }

        if (value.trim() || attachedImages.length > 0) {
            e.preventDefault();
            handleSubmit();
        }
    };

    // Paste handler: intercept clipboard images
    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items
        if (!items) return

        const files: File[] = []
        for (let i = 0; i < items.length; i += 1) {
            const item = items[i]
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile()
                if (file) files.push(file)
            }
        }

        if (files.length > 0) {
            e.preventDefault()
            void addFiles(files)
        }
    }, [addFiles])

    // Drag-and-drop handlers
    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(true)
    }, [])

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(false)
    }, [])

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDraggingOver(false)
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            void addFiles(e.dataTransfer.files)
        }
    }, [addFiles])

    // File input change handler
    const handleFileInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            void addFiles(e.target.files)
        }
    }, [addFiles])

    const selectedModel = availableModels.find(m => m.id === selectedModelId) || availableModels[0];
    const canSubmit = value.trim().length > 0 || attachedImages.length > 0

    return (
        <div className="w-full">
            <div
                className={cn(
                    "rounded-xl border overflow-hidden transition-colors",
                    isDraggingOver
                        ? "border-blue-500/50 bg-blue-500/[0.04]"
                        : "border-white/[0.06] bg-white/[0.03]"
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <div className="relative">
                    <div className="relative flex flex-col">

                        {/* Image preview chips */}
                        {attachedImages.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
                                {attachedImages.map((img) => (
                                    <div
                                        key={img.id}
                                        className="relative group rounded-md overflow-hidden border border-white/[0.08] bg-black/20"
                                        style={{ width: 48, height: 48 }}
                                    >
                                        <img
                                            src={img.dataUrl}
                                            alt={img.name}
                                            className="w-full h-full object-cover"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(img.id)}
                                            aria-label={`Remove ${img.name}`}
                                            className="absolute top-0 right-0 p-0.5 rounded-bl-md bg-black/60 text-white/80 hover:bg-black/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {/* Queued prompt chip (Bug #5) */}
                        {isGenerating && queuedPrompt ? (
                            <div className="px-2.5 pb-1">
                                <div className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md px-2 py-1 text-[11px] text-blue-400">
                                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
                                    <span className="truncate max-w-[200px]">Queued: {queuedPrompt}</span>
                                    <button
                                        type="button"
                                        onClick={onCancelQueued}
                                        className="ml-1 p-0.5 rounded hover:bg-blue-500/20 transition-colors"
                                        aria-label="Cancel queued prompt"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ) : null}

                        <div
                            className="overflow-y-auto"
                            style={{ maxHeight: "100px" }}
                        >
                            <Textarea
                                id="ai-input-15"
                                value={value}
                                placeholder={onEnhance
                                    ? "What can I do for you? Type a UI prompt to unlock Prompt Enhance."
                                    : "What can I do for you?"}
                                className={cn(
                                    "w-full px-2.5 py-2 pr-10 bg-transparent border-none text-zinc-100 placeholder:text-zinc-500 resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-xs",
                                    "min-h-[52px]"
                                )}
                                ref={textareaRef}
                                onKeyDown={handleKeyDown}
                                onPaste={handlePaste}
                                onChange={(e) => {
                                    setValue(e.target.value);
                                    adjustHeight();
                                }}
                            />

                            {onEnhance && value.trim() ? (
                                <div className="absolute right-1.5 top-1.5">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={handleEnhance}
                                                disabled={isEnhancing}
                                                aria-label="Enhance prompt"
                                                className="rounded-md bg-black/5 text-black/50 hover:bg-black/10 hover:text-black dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
                                            >
                                                {isEnhancing ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Sparkles className="h-3 w-3" />
                                                )}
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="left" sideOffset={8}>
                                            Improve this UI prompt without changing its meaning
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                            ) : null}
                        </div>

                        <div className="h-9 bg-white/[0.02] border-t border-white/[0.04] flex items-center">
                            <div className="absolute left-1.5 right-1.5 bottom-1.5 flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                className="flex items-center gap-1 h-6 pl-1 pr-1.5 text-[11px] rounded-md dark:text-white hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-none"
                                                disabled={isLoadingModels || isEnhancing}
                                            >
                                                <AnimatePresence mode="wait">
                                                    <motion.div
                                                        key={selectedModelId}
                                                        initial={{
                                                            opacity: 0,
                                                            y: -5,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            y: 0,
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            y: 5,
                                                        }}
                                                        transition={{
                                                            duration: 0.15,
                                                        }}
                                                        className="flex items-center gap-1"
                                                    >
                                                        {isLoadingModels ? (
                                                            <>
                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                <span>Loading...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Bot className="w-3.5 h-3.5 opacity-70" />
                                                                {selectedModel?.name || "Select Model"}
                                                                <ChevronDown className="w-2.5 h-2.5 opacity-50" />
                                                            </>
                                                        )}
                                                    </motion.div>
                                                </AnimatePresence>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                            className={cn(
                                                "min-w-[10rem]",
                                                "border-black/10 dark:border-white/10",
                                                "bg-gradient-to-b from-white via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-800"
                                            )}
                                        >
                                            {availableModels.map((model) => (
                                                <DropdownMenuItem
                                                    key={model.id}
                                                    onSelect={() =>
                                                        setSelectedModelId(model.id)
                                                    }
                                                    className="flex items-center justify-between gap-2"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Bot className="w-4 h-4 opacity-50" />
                                                        <span>{model.name}</span>
                                                    </div>
                                                    {selectedModelId === model.id && (
                                                        <Check className="w-4 h-4 text-blue-500" />
                                                    )}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <div className="h-3 w-px bg-white/[0.06]" />
                                    <label
                                        className={cn(
                                            "rounded-md p-1 bg-black/5 dark:bg-white/5",
                                            "hover:bg-black/10 dark:hover:bg-white/10 focus-visible:outline-none",
                                            "text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white",
                                            (isGenerating || isEnhancing || !isVisionCapableModel(selectedModelId)) && "opacity-50 cursor-not-allowed pointer-events-none",
                                            !isGenerating && !isEnhancing && isVisionCapableModel(selectedModelId) && "cursor-pointer"
                                        )}
                                        aria-label="Attach images"
                                        title={!isVisionCapableModel(selectedModelId) ? "This model doesn't support image input. Switch to a vision-capable model." : "Attach images"}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            onChange={handleFileInputChange}
                                            accept="image/*"
                                            multiple
                                            disabled={isGenerating || isEnhancing || !isVisionCapableModel(selectedModelId)}
                                        />
                                        <Paperclip className="w-3 h-3 transition-colors" />
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    className={cn(
                                        "rounded-md p-1 bg-black/5 dark:bg-white/5",
                                        "focus-visible:outline-none",
                                        isGenerating
                                            ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/15 dark:text-rose-300"
                                            : "hover:bg-black/10 dark:hover:bg-white/10"
                                    )}
                                    aria-label={isGenerating ? "Cancel generation" : "Send message"}
                                    disabled={(!isGenerating && !canSubmit) || isEnhancing}
                                    onClick={() => {
                                        if (isGenerating) {
                                            onCancel?.();
                                            return;
                                        }

                                        handleSubmit();
                                    }}
                                >
                                    {isGenerating ? (
                                        <X className="w-3 h-3 transition-opacity duration-200" />
                                    ) : (
                                        <ArrowRight
                                            className={cn(
                                                "w-3 h-3 dark:text-white transition-opacity duration-200",
                                                canSubmit
                                                    ? "opacity-100"
                                                    : "opacity-30"
                                            )}
                                        />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
