import { Logo } from "./components/Logo";
import { Toolbar } from "./components/Toolbar";
import { insertFormat, detectActiveFormats } from "./EditorUtils";
import { cn } from "./lib/utils";
import {
  Download,
  Save,
  Printer,
  FilePlus,
  HelpCircle,
  Moon,
  Sun,
  Upload,
  X,
  Type,
  Layout,
  Columns,
  Code,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { marked } from "marked";
import TurndownService from "turndown";
// @ts-ignore
import { tables } from "turndown-plugin-gfm";
import { useRegisterSW } from "virtual:pwa-register/react";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});
turndownService.use(tables);

turndownService.addRule("strikethrough", {
  filter: ["del", "s", "strike"] as any,
  replacement: function (content) {
    return "~~" + content + "~~";
  },
});

const HELP_MD = `
# Markdown Help Guide

Markdown is a lightweight markup language that you can use to add formatting elements to plaintext text documents.

## Basic Syntax

### Headings
To create a heading, add number signs (\`#\`) in front of a word or phrase.
\`\`\`markdown
# Heading level 1
## Heading level 2
### Heading level 3
\`\`\`

### Emphasis
- **Bold**: Add two asterisks (e.g. \`**bold**\`).
- *Italic*: Add one asterisk (e.g. \`*italic*\`).
- ~~Strikethrough~~: Add two tildes (e.g. \`~~crossed out~~\`).

### Lists
**Unordered list:**
\`\`\`markdown
- Item 1
- Item 2
  - Sub-item
\`\`\`

**Ordered list:**
\`\`\`markdown
1. First item
2. Second item
\`\`\`

### Links & Images
- Link: \`[Title](https://example.com)\`
- Image: \`![Alt Text](url-to-image.jpg)\`
`;

type ViewMode = "markdown" | "split" | "format";
type Theme = "light" | "dark";
type ActiveEditor = "markdown" | "format";

const DEFAULT_DOC = `# Welcome to MarkFlow ⚡️

An award-winning, sleek markdown editor built for speed and focus. 

## Features
- **Split-pane view**: See your edits happen in real-time.
- **Rich formatting**: Use the toolbar above to apply Markdown effortlessly.
- **Local management**: Create, Open, and Save \`.md\` files directly to your machine.
- **Responsive design**: Works beautifully on desktops, and cleanly degrades to a focused view on smaller screens.
- **Offline / PWA Ready**: Install the app on your device to edit markdown offline.
- **Dark Mode**: Switch between soothing aesthetic themes seamlessly.

Try it out! Highlight this text and click **Bold** in the toolbar! 
`;

export default function App() {
  const [content, setContent] = useState(DEFAULT_DOC);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [activeEditor, setActiveEditor] = useState<ActiveEditor>("markdown");
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme");
    return (saved as Theme) || "light";
  });
  const [showHelp, setShowHelp] = useState(false);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);

  // Custom upscale gradient / background state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Resizable panes state
  const [leftWidth, setLeftWidth] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formatRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const [fileName, setFileName] = useState("untitled.md");
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(
    null,
  );
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);

  // Link & Image Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const fileImageRef = useRef<HTMLInputElement>(null);
  const [savedSelection, setSavedSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const [isStandalone, setIsStandalone] = useState(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState(true);

  useEffect(() => {
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as any).standalone,
    );
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleChange = (e: MediaQueryListEvent) => setIsStandalone(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Background checks for updates when offline may not work, as the server is unreachable.
      // If the app checks for updates offline, it will simply fail silently and continue to serve the cached offline assets.
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  useEffect(() => {
    document.documentElement.className = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (
        saveMenuRef.current &&
        !saveMenuRef.current.contains(event.target as Node)
      ) {
        setIsSaveMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  // PWA Install prompt listener
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () =>
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
      }
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && viewMode === "split") {
        setViewMode("markdown");
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode]);

  // Handle panel resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const newLeftWidth = (e.clientX / containerWidth) * 100;
      if (newLeftWidth > 20 && newLeftWidth < 80) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (
      formatRef.current &&
      (activeEditor === "markdown" || formatRef.current.innerHTML === "")
    ) {
      formatRef.current.innerHTML = marked.parse(content) as string;
    }
  }, [content, activeEditor, viewMode]);

  const handleSelectionChange = useCallback(() => {
    if (activeEditor === "markdown" && textareaRef.current) {
      const formats = detectActiveFormats(
        content,
        textareaRef.current.selectionStart,
      );
      setActiveFormats(formats);
    } else if (activeEditor === "format") {
      // A simplistic active format detection for contentEditable
      const formats = [];
      if (document.queryCommandState("bold")) formats.push("bold");
      if (document.queryCommandState("italic")) formats.push("italic");
      if (document.queryCommandState("strikeThrough"))
        formats.push("strikethrough");
      if (document.queryCommandState("insertUnorderedList")) formats.push("ul");
      if (document.queryCommandState("insertOrderedList")) formats.push("ol");

      const formatBlock = document.queryCommandValue("formatBlock");
      if (formatBlock) {
        const block = formatBlock.toLowerCase();
        if (block === "h1" || block === "heading 1" || block === "<h1>")
          formats.push("h1");
        if (block === "h2" || block === "heading 2" || block === "<h2>")
          formats.push("h2");
        if (block === "h3" || block === "heading 3" || block === "<h3>")
          formats.push("h3");
        if (block === "blockquote" || block === "<blockquote>")
          formats.push("quote");
      }

      setActiveFormats(formats);
    }
  }, [content, activeEditor]);

  const syncFormatToMarkdown = () => {
    if (formatRef.current) {
      setContent(turndownService.turndown(formatRef.current.innerHTML));
    }
  };

  const handleFormat = (format: string) => {
    if (format === "link" || format === "image") {
      if (activeEditor === "markdown" && textareaRef.current) {
        setSavedSelection({
          start: textareaRef.current.selectionStart,
          end: textareaRef.current.selectionEnd,
        });
      } else {
        // Save the native range for contentEditable
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          // (Store simplistic range in window for restoring later)
          (window as any)._savedRange = selection.getRangeAt(0);
        }
      }
      if (format === "link") setShowLinkModal(true);
      else setShowImageModal(true);
      return;
    }

    if (activeEditor === "format" && formatRef.current) {
      // WYSIWYG commands
      if (format === "bold") document.execCommand("bold", false, undefined);
      else if (format === "italic")
        document.execCommand("italic", false, undefined);
      else if (format === "strikethrough")
        document.execCommand("strikeThrough", false, undefined);
      else if (format === "ul")
        document.execCommand("insertUnorderedList", false, undefined);
      else if (format === "ol")
        document.execCommand("insertOrderedList", false, undefined);
      else if (format === "code") {
        document.execCommand(
          "insertHTML",
          false,
          "<pre><code>console.log('Hello');</code></pre><p><br></p>",
        );
      } else if (format === "table") {
        document.execCommand(
          "insertHTML",
          false,
          "<table border='1'><thead><tr><th>Header 1</th><th>Header 2</th></tr></thead><tbody><tr><td>Cell 1</td><td>Cell 2</td></tr></tbody></table><p><br></p>",
        );
      } else if (format.startsWith("h") || format === "quote") {
        const currentBlock = document
          .queryCommandValue("formatBlock")
          ?.toLowerCase();
        const targetBlock = format === "quote" ? "blockquote" : format;
        // In Safari/Firefox, it might be 'heading 1', in Chrome 'h1'
        if (
          currentBlock === targetBlock ||
          currentBlock ===
            (format === "quote" ? "blockquote" : `heading ${format[1]}`) ||
          currentBlock ===
            (format === "quote" ? "blockquote" : `<h${format[1]}>`)
        ) {
          document.execCommand("formatBlock", false, "div");
        } else {
          document.execCommand("formatBlock", false, targetBlock.toUpperCase());
        }
      }
      syncFormatToMarkdown();
      setTimeout(() => {
        if (document.activeElement !== formatRef.current) {
          formatRef.current?.focus();
        }
        handleSelectionChange();
      }, 0);
      return;
    }

    if (activeEditor === "markdown" && textareaRef.current) {
      insertFormat(textareaRef.current, format, (val) => {
        setContent(val);
        setTimeout(() => handleSelectionChange(), 0);
      });
    }
  };

  const submitLink = (e: React.FormEvent) => {
    e.preventDefault();
    setShowLinkModal(false);

    if (activeEditor === "format" && formatRef.current) {
      const savedRange = (window as any)._savedRange;
      if (savedRange) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedRange);
        document.execCommand("createLink", false, linkUrl);
        syncFormatToMarkdown();
      }
    } else if (
      activeEditor === "markdown" &&
      textareaRef.current &&
      savedSelection
    ) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = savedSelection.start;
      textareaRef.current.selectionEnd = savedSelection.end;
      insertFormat(
        textareaRef.current,
        "link",
        (val) => {
          setContent(val);
          setTimeout(() => handleSelectionChange(), 0);
        },
        linkUrl,
      );
    }
    setLinkUrl("");
  };

  const submitImage = (e: React.FormEvent) => {
    e.preventDefault();
    setShowImageModal(false);

    if (activeEditor === "format" && formatRef.current) {
      const savedRange = (window as any)._savedRange;
      if (savedRange) {
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedRange);
        document.execCommand("insertImage", false, imageUrl);
        syncFormatToMarkdown();
      }
    } else if (
      activeEditor === "markdown" &&
      textareaRef.current &&
      savedSelection
    ) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = savedSelection.start;
      textareaRef.current.selectionEnd = savedSelection.end;
      insertFormat(
        textareaRef.current,
        "image",
        (val) => {
          setContent(val);
          setTimeout(() => handleSelectionChange(), 0);
        },
        imageUrl,
      );
    }
    setImageUrl("");
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setImageUrl(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleMarkdownKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const cursor = textarea.selectionStart;
      const text = content;
      
      const lineStart = text.lastIndexOf('\n', cursor - 1) + 1;
      let lineEnd = text.indexOf('\n', cursor);
      if (lineEnd === -1) lineEnd = text.length;

      const currentLine = text.substring(lineStart, lineEnd);
      
      if (currentLine.trim().startsWith('|') || currentLine.includes('|')) {
        e.preventDefault();
        
        let nextPipe = text.indexOf('|', cursor);
        
        if (nextPipe !== -1 && nextPipe < lineEnd) {
            let nextCursor = nextPipe + 1;
            while(text[nextCursor] === ' ' && nextCursor < lineEnd) nextCursor++;
            textarea.selectionStart = nextCursor;
            textarea.selectionEnd = nextCursor;
            handleSelectionChange();
            return;
        } else {
            if (lineEnd === text.length) {
                 const pipesCount = (currentLine.match(/\|/g) || []).length;
                 if (pipesCount > 1) {
                     const newRow = '\n' + '|     '.repeat(pipesCount - 1) + '|';
                     const newText = text + newRow;
                     setContent(newText);
                     setTimeout(() => {
                        textarea.selectionStart = text.length + 3;
                        textarea.selectionEnd = text.length + 3;
                        handleSelectionChange();
                     }, 0);
                 }
                 return;
            }
            
            const nextLineEnd = text.indexOf('\n', lineEnd + 1) === -1 ? text.length : text.indexOf('\n', lineEnd + 1);
            const nextLine = text.substring(lineEnd + 1, nextLineEnd);
            
            if (nextLine.trim().startsWith('|') || nextLine.includes('|')) {
               let firstPipe = text.indexOf('|', lineEnd);
               if (firstPipe !== -1) {
                  let nextCursor = firstPipe + 1;
                  while(text[nextCursor] === ' ' && nextCursor < nextLineEnd) nextCursor++;
                  textarea.selectionStart = nextCursor;
                  textarea.selectionEnd = nextCursor;
                  handleSelectionChange();
               }
            } else {
                 const pipesCount = (currentLine.match(/\|/g) || []).length;
                 if (pipesCount > 1) {
                     const newRow = '\n' + '|     '.repeat(pipesCount - 1) + '|';
                     const newText = text.substring(0, lineEnd) + newRow + text.substring(lineEnd);
                     setContent(newText);
                     setTimeout(() => {
                        textarea.selectionStart = lineEnd + 3;
                        textarea.selectionEnd = lineEnd + 3;
                        handleSelectionChange();
                     }, 0);
                 }
            }
            return;
        }
      }
    }
    handleSelectionChange();
  };

  const handleFormatKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Tab") {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return;
      
      let node: Node | null = selection.anchorNode;
      let td: HTMLTableCellElement | null = null;
      let tr: HTMLTableRowElement | null = null;
      
      while (node && node !== formatRef.current) {
        if (node.nodeName.toLowerCase() === 'td' || node.nodeName.toLowerCase() === 'th') {
            td = node as HTMLTableCellElement;
        }
        if (node.nodeName.toLowerCase() === 'tr') {
            tr = node as HTMLTableRowElement;
            break;
        }
        node = node.parentNode;
      }
      
      if (td && tr) {
        e.preventDefault();
        
        let targetCell: HTMLTableCellElement | null = null;
        
        if (e.shiftKey) {
            if (td.previousElementSibling) {
                targetCell = td.previousElementSibling as HTMLTableCellElement;
            } else if (tr.previousElementSibling) {
                const prevRow = tr.previousElementSibling as HTMLTableRowElement;
                if (prevRow.lastElementChild) {
                    targetCell = prevRow.lastElementChild as HTMLTableCellElement;
                }
            }
        } else {
            if (td.nextElementSibling) {
                targetCell = td.nextElementSibling as HTMLTableCellElement;
            } else if (tr.nextElementSibling) {
                const nextRow = tr.nextElementSibling as HTMLTableRowElement;
                if (nextRow.firstElementChild) {
                    targetCell = nextRow.firstElementChild as HTMLTableCellElement;
                }
            } else {
                 const tbody = tr.parentNode;
                 if (tbody && (tbody.nodeName.toLowerCase() === 'tbody' || tbody.nodeName.toLowerCase() === 'table')) {
                    const newTr = document.createElement('tr');
                    const cols = tr.children.length;
                    for (let i = 0; i < cols; i++) {
                        const newTd = document.createElement('td');
                        newTd.innerHTML = '<br>';
                        newTr.appendChild(newTd);
                    }
                    if (tr.nextSibling) {
                        tbody.insertBefore(newTr, tr.nextSibling);
                    } else {
                        tbody.appendChild(newTr);
                    }
                    targetCell = newTr.firstElementChild as HTMLTableCellElement;
                 }
            }
        }
        
        if (targetCell) {
            const range = document.createRange();
            range.selectNodeContents(targetCell);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            targetCell.focus();
            
            syncFormatToMarkdown();
        }
      }
    }
  };

  const handleNew = () => {
    if (window.confirm("Are you sure? Unsaved changes will be lost.")) {
      setContent("");
      setFileName("untitled.md");
      setFileHandle(null);
      if (textareaRef.current) textareaRef.current.focus();
    }
  };

  const loadTextFile = useCallback(async (file: File, handle?: FileSystemFileHandle) => {
    const newContent = await file.text();
    setFileName(file.name || "untitled.md");
    setFileHandle(handle || null);
    setContent(newContent);
    if (formatRef.current) {
      formatRef.current.innerHTML = marked.parse(newContent) as string;
    }
    setActiveFormats([]);
  }, []);

  useEffect(() => {
    if (!window.launchQueue) return;

    window.launchQueue.setConsumer(async (launchParams) => {
      const fileHandle = launchParams.files?.[0];
      if (!fileHandle) return;

      try {
        const file = await fileHandle.getFile();
        await loadTextFile(file, fileHandle);
      } catch (error) {
        console.error("Unable to open launched file", error);
      }
    });
  }, [loadTextFile]);

  const handleOpenClick = async () => {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Markdown files",
              accept: {
                "text/markdown": [".md", ".markdown"],
                "text/plain": [".txt"],
              },
            },
          ],
        });

        const file = await handle.getFile();
        await loadTextFile(file, handle);
        return;
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          console.error("Unable to open file", error);
        }
        return;
      }
    }

    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    void loadTextFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const downloadFile = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const writeFile = async (handle: FileSystemFileHandle) => {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  };

  const handleSaveAs = async () => {
    setIsSaveMenuOpen(false);

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "Markdown files",
              accept: {
                "text/markdown": [".md", ".markdown"],
                "text/plain": [".txt"],
              },
            },
          ],
        });

        await writeFile(handle);
        setFileHandle(handle);
        const file = await handle.getFile();
        setFileName(file.name || fileName);
        return;
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          console.error("Unable to save file", error);
        }
        return;
      }
    }

    downloadFile();
  };

  const handleSave = async () => {
    setIsSaveMenuOpen(false);

    if (fileHandle) {
      try {
        await writeFile(fileHandle);
        return;
      } catch (error) {
        console.error("Unable to overwrite file", error);
      }
    }

    await handleSaveAs();
  };

  return (
    <div
      className={cn(
        "h-screen w-full flex flex-col overflow-hidden transition-colors duration-300",
        theme,
      )}
    >
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex-none h-16 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md flex items-center justify-between z-20 shadow-sm transition-colors duration-300">
          <div className="flex min-w-0 items-center">
            {isStandalone ? (
              <h1
                className="max-w-[32vw] truncate text-sm font-semibold text-[var(--text-strong)] sm:max-w-[42vw]"
                title={fileName}
              >
                {fileName}
              </h1>
            ) : (
              <Logo className="h-8 w-auto text-[var(--brand-600)]" />
            )}
          </div>

          {/* Header Controls Toggle */}
          <div className="flex-1 flex justify-end items-center">
            <div
              className={cn(
                "flex items-center space-x-4 transition-all duration-300 origin-right overflow-hidden",
                isControlsExpanded
                  ? "opacity-100 max-w-[800px] visible"
                  : "opacity-0 max-w-0 invisible",
              )}
            >
              <div className="flex bg-[var(--bg-elevated)] p-1 rounded-lg border border-[var(--border-subtle)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                <button
                  onClick={() => {
                    setViewMode("markdown");
                    setActiveEditor("markdown");
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all",
                    viewMode === "markdown"
                      ? "bg-[var(--brand-600)]/10 text-[var(--brand-600)] shadow-sm border border-[var(--brand-600)]/20"
                      : "text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] border border-transparent",
                  )}
                >
                  <Code size={14} className="hidden sm:inline-block" /> Markup
                </button>
                <button
                  onClick={() => setViewMode("split")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all hidden md:flex",
                    viewMode === "split"
                      ? "bg-[var(--brand-600)]/10 text-[var(--brand-600)] shadow-sm border border-[var(--brand-600)]/20"
                      : "text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] border border-transparent",
                  )}
                >
                  <Columns size={14} className="hidden lg:inline-block" /> Split
                </button>
                <button
                  onClick={() => {
                    setViewMode("format");
                    setActiveEditor("format");
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all",
                    viewMode === "format"
                      ? "bg-[var(--brand-600)]/10 text-[var(--brand-600)] shadow-sm border border-[var(--brand-600)]/20"
                      : "text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] border border-transparent",
                  )}
                >
                  <Type size={14} className="hidden sm:inline-block" /> Format
                </button>
              </div>

              {/* File Operations */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleNew}
                  title="New File"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-[var(--text-muted)] hover:text-[var(--brand-600)] hover:bg-[var(--bg-hover)] active:bg-[var(--border-subtle)] transition-colors"
                >
                  <FilePlus size={16} />
                  <span className="hidden lg:inline">New</span>
                </button>
                <button
                  onClick={handleOpenClick}
                  title="Open File"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-[var(--text-muted)] hover:text-[var(--brand-600)] hover:bg-[var(--bg-hover)] active:bg-[var(--border-subtle)] transition-colors"
                >
                  <Upload size={16} />
                  <span className="hidden lg:inline">Open</span>
                </button>
                <input
                  type="file"
                  accept=".md,.txt,.markdown"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <div ref={saveMenuRef} className="relative flex">
                  <button
                    onClick={handleSave}
                    title="Save File"
                    className="flex items-center gap-1.5 rounded-l-md px-3 py-1.5 text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--brand-600)] active:bg-[var(--border-subtle)]"
                  >
                    <Save size={16} />
                    <span className="hidden lg:inline">Save</span>
                  </button>
                  <button
                    onClick={() => setIsSaveMenuOpen((open) => !open)}
                    title="Save Options"
                    aria-haspopup="menu"
                    aria-expanded={isSaveMenuOpen}
                    className="flex items-center rounded-r-md border-l border-[var(--border-subtle)] px-1.5 py-1.5 text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--brand-600)] active:bg-[var(--border-subtle)]"
                  >
                    <ChevronDown size={14} />
                  </button>
                  {isSaveMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full z-40 mt-2 min-w-36 overflow-hidden rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1 shadow-lg"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSave}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <Save size={15} />
                        Save
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSaveAs}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--text-strong)] transition-colors hover:bg-[var(--bg-hover)]"
                      >
                        <FilePlus size={15} />
                        Save As
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => window.print()}
                  title="Print"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-[var(--text-muted)] hover:text-[var(--brand-600)] hover:bg-[var(--bg-hover)] active:bg-[var(--border-subtle)] transition-colors"
                >
                  <Printer size={16} />
                  <span className="hidden lg:inline">Print</span>
                </button>

                <div className="h-4 w-[1px] bg-[var(--border-subtle)] mx-2" />

                {needRefresh ? (
                  <button
                    onClick={() => updateServiceWorker(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] transition-colors animate-pulse"
                  >
                    <Download size={16} />
                    <span className="hidden lg:inline">Update App</span>
                  </button>
                ) : (
                  !isStandalone && (
                    <button
                      onClick={() => {
                        if (deferredPrompt) {
                          handleInstallClick();
                        } else {
                          setShowInstallHelp(true);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-[var(--brand-600)] hover:bg-[var(--brand-600)]/10 transition-colors"
                    >
                      <Download size={16} />
                      <span className="hidden lg:inline">Install</span>
                    </button>
                  )
                )}
              </div>

              <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-4 ml-2">
                <button
                  onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                  title="Toggle Theme"
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--brand-600)] hover:bg-[var(--bg-hover)] rounded-full transition-colors"
                >
                  {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
                </button>
                <button
                  onClick={() => setShowHelp(true)}
                  title="Help & Syntax Guide"
                  className="p-2 text-[var(--text-muted)] hover:text-[var(--brand-600)] hover:bg-[var(--bg-hover)] rounded-full transition-colors"
                >
                  <HelpCircle size={18} />
                </button>
              </div>
            </div>

            <button
              onClick={() => setIsControlsExpanded(!isControlsExpanded)}
              className="p-2 ml-4 text-[var(--text-muted)] hover:text-[var(--brand-600)] hover:bg-[var(--bg-hover)] rounded-full transition-colors z-30"
              title={isControlsExpanded ? "Hide Controls" : "Show Controls"}
            >
              {isControlsExpanded ? (
                <ChevronRight size={20} />
              ) : (
                <ChevronLeft size={20} />
              )}
            </button>
          </div>
        </header>

        {/* Main Workspace Area */}
        <div className="flex-none">
          <Toolbar onFormat={handleFormat} activeFormats={activeFormats} />
        </div>
        <main
          ref={containerRef}
          className="flex-1 flex overflow-hidden relative border-t border-[var(--border-subtle)]"
        >
          {/* Editor Pane (Markdown view) */}
          <section
            style={{ width: viewMode === "split" ? `${leftWidth}%` : "100%" }}
            className={cn(
              "flex flex-col h-full bg-[var(--bg-base)] transition-colors duration-300 print-hidden",
              viewMode === "format" ? "hidden" : "flex",
              viewMode === "split" && "flex-none",
              activeEditor === "markdown" && viewMode === "split"
                ? "ring-2 ring-[var(--brand-600)]/30 ring-inset"
                : "",
            )}
            onClick={() =>
              viewMode === "split" && setActiveEditor("markdown")
            }
          >
              <div className="flex-1 overflow-hidden relative">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                  }}
                  onSelect={handleSelectionChange}
                  onKeyUp={handleMarkdownKeyDown}
                  onKeyDown={handleMarkdownKeyDown}
                  onClick={handleSelectionChange}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  className="absolute inset-0 w-full h-full p-8 font-mono text-[14px] leading-8 bg-transparent text-[var(--text-strong)] resize-none editor-textarea focus:outline-none"
                  placeholder="Start typing your markdown here..."
                />
              </div>
          </section>

          {/* Resizer Handler */}
          <div
            className={cn(
              "w-3 mx-[-1.5px] cursor-col-resize flex justify-center items-center z-30 group print-hidden",
              viewMode !== "split" && "hidden"
            )}
            onMouseDown={() => setIsResizing(true)}
            title="Drag to resize panels"
          >
            <div className="w-[1px] h-full bg-[var(--border-subtle)] group-hover:bg-[var(--brand-600)] group-hover:w-[3px] group-active:bg-[var(--brand-600)] group-active:w-[3px] transition-all"></div>
          </div>

          {/* Format Pane (Preview / WYSIWYG) */}
          <section
            style={{
              width: viewMode === "split" ? `${100 - leftWidth}%` : "100%",
            }}
            className={cn(
              "flex flex-col h-full overflow-y-auto bg-[var(--bg-surface)] backdrop-blur-md transition-colors duration-300 shadow-[-4px_0_24px_rgba(0,0,0,0.04)]",
              viewMode === "markdown" ? "hidden" : "flex",
              viewMode === "split" && "flex-none",
              activeEditor === "format" && viewMode === "split"
                ? "ring-2 ring-[var(--brand-600)]/30 ring-inset"
                : "",
              "preview-pane-print"
            )}
            onClick={() => viewMode === "split" && setActiveEditor("format")}
          >
              <div
                className={cn(
                  "p-8 lg:p-12 h-full min-h-[100%] flex-1",
                  viewMode !== "split" && "w-full max-w-4xl mx-auto",
                )}
              >
                <div
                  ref={formatRef}
                  className="markdown-body min-h-[50vh] focus:outline-none"
                  contentEditable
                  suppressContentEditableWarning
                  onSelect={handleSelectionChange}
                  onKeyUp={handleSelectionChange}
                  onKeyDown={handleFormatKeyDown}
                  onMouseUp={handleSelectionChange}
                  onInput={syncFormatToMarkdown}
                />
              </div>
            </section>
        </main>

        {/* Status Bar */}
        <footer className="flex-none h-9 px-6 flex items-center justify-between bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider z-10 transition-colors duration-300 backdrop-blur-xl">
          <div className="flex space-x-6 items-center">
            <span className="flex items-center gap-2 text-[var(--text-strong)]">
              <span className="w-4 h-4 rounded bg-[var(--brand-600)]/20 text-[var(--brand-600)] flex items-center justify-center">
                #
              </span>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="bg-transparent border-none outline-none text-[var(--text-strong)] font-semibold w-[150px] focus:ring-1 focus:ring-[var(--brand-600)] px-1 -mx-1 rounded truncate tracking-wider"
                title="Rename file"
                spellCheck={false}
              />
            </span>
            <span>UTF-8</span>
            <span>Markdown</span>
          </div>
          <div className="flex items-center space-x-6">
            <span className="flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
              Local Document
            </span>
            <span className="font-mono text-[10px] bg-[var(--bg-hover)] px-2 py-0.5 rounded text-[var(--text-strong)] border border-[var(--border-subtle)]">
              {content.length} chars
            </span>
          </div>
        </footer>

        {/* Help Modal */}
        {showHelp && (
          <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <h2 className="font-semibold flex items-center gap-2 text-[var(--text-strong)]">
                  <HelpCircle size={18} className="text-[var(--brand-600)]" />
                  Help & Syntax Guide
                </h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 bg-[var(--bg-base)]">
                <div className="markdown-body">
                  <Markdown remarkPlugins={[remarkGfm]}>{HELP_MD}</Markdown>
                </div>
              </div>
              <div className="p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-right">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-6 py-2.5 bg-[var(--brand-600)] text-white font-medium rounded-lg hover:bg-[var(--brand-700)] transition-colors text-sm shadow-md"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Link Modal */}
        {showLinkModal && (
          <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
            <form
              onSubmit={submitLink}
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <h2 className="font-semibold text-[var(--text-strong)]">
                  Insert Link
                </h2>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 bg-[var(--bg-base)]">
                <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                  URL
                </label>
                <input
                  type="url"
                  autoFocus
                  required
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-4 py-2 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)] transition-shadow"
                />
              </div>
              <div className="p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  className="px-5 py-2 text-[var(--text-strong)] font-medium rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[var(--brand-600)] text-white font-medium rounded-lg hover:bg-[var(--brand-700)] transition-colors text-sm shadow-md"
                >
                  Insert
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Image Modal */}
        {showImageModal && (
          <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
            <form
              onSubmit={submitImage}
              className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <h2 className="font-semibold text-[var(--text-strong)]">
                  Insert Image
                </h2>
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 bg-[var(--bg-base)]">
                <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                  Image URL
                </label>
                <input
                  autoFocus
                  type="text"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]/50 focus:border-[var(--brand-600)] transition-all placeholder:text-[var(--text-muted)] mb-4"
                />
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[var(--border-subtle)]"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-[var(--bg-base)] text-[var(--text-muted)]">Or</span>
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-[var(--text-strong)] mb-2">
                    Upload Local Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileImageRef}
                    onChange={handleImageFileChange}
                    className="block w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-[var(--brand-600)]/10 file:text-[var(--brand-600)] hover:file:bg-[var(--brand-600)]/20 file:transition-colors cursor-pointer"
                  />
                  {imageUrl && imageUrl.startsWith('data:image') && (
                    <div className="mt-4 border border-[var(--border-subtle)] rounded-lg p-2 bg-[var(--bg-surface)]">
                      <img src={imageUrl} alt="Preview" className="max-h-32 object-contain mx-auto rounded-md" />
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-end gap-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => setShowImageModal(false)}
                  className="px-4 py-2 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!imageUrl}
                  className="px-4 py-2 text-sm font-medium bg-[var(--brand-600)] text-white rounded-md hover:bg-[var(--brand-700)] hover:shadow-md shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Insert
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Install Help Modal */}
        {showInstallHelp && (
          <div className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="flex items-center justify-between p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                <h2 className="font-semibold text-[var(--text-strong)] flex items-center gap-2">
                  <Download size={18} className="text-[var(--brand-600)]" />
                  Install App
                </h2>
                <button
                  type="button"
                  onClick={() => setShowInstallHelp(false)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 bg-[var(--bg-base)] text-[var(--text-strong)] space-y-4 text-sm leading-relaxed">
                <p>
                  To install MarkFlow as a standalone application, look for the
                  install icon in your browser's address bar.
                </p>
                <div className="bg-[var(--bg-surface)] p-4 rounded-lg border border-[var(--border-subtle)] flex justify-center">
                  <div className="flex bg-[var(--bg-hover)] px-3 py-1.5 rounded-full items-center gap-2 border border-[var(--border-subtle)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      example.com
                    </span>
                    <Download size={12} className="text-[var(--text-muted)]" />
                  </div>
                </div>
                <p>
                  On iOS Safari, tap the <strong>Share</strong> button and
                  select <strong>Add to Home Screen</strong>.
                </p>
                <p className="text-[var(--text-muted)] text-xs">
                  Note: If you are viewing this inside an embedded preview, you
                  may need to open the app in a new tab first.
                </p>
              </div>
              <div className="p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowInstallHelp(false)}
                  className="px-5 py-2 bg-[var(--brand-600)] text-white font-medium rounded-lg hover:bg-[var(--brand-700)] transition-colors text-sm shadow-md"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
