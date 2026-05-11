import { Logo } from "./components/Logo";
import { Toolbar } from "./components/Toolbar";
import { insertFormat, detectActiveFormats } from "./EditorUtils";
import { cn } from "./lib/utils";
import {
  Download,
  Save,
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
} from "lucide-react";
import React, { useEffect, useRef, useState, useCallback } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { marked } from "marked";
import TurndownService from "turndown";
import { useRegisterSW } from "virtual:pwa-register/react";

const turndownService = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

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
  const [theme, setTheme] = useState<Theme>("dark"); // Let's default to dark for the polished feel
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
  const [fileName, setFileName] = useState("untitled.md");

  // Link Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [savedSelection, setSavedSelection] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const [isStandalone, setIsStandalone] = useState(false);

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
  }, [theme]);

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
        if (block === "h1" || block === "heading 1") formats.push("h1");
        if (block === "h2" || block === "heading 2") formats.push("h2");
        if (block === "h3" || block === "heading 3") formats.push("h3");
        if (block === "blockquote") formats.push("quote");
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
    if (format === "link") {
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
      setShowLinkModal(true);
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
      else if (format.startsWith("h") || format === "quote") {
        const currentBlock = document
          .queryCommandValue("formatBlock")
          ?.toLowerCase();
        const targetBlock = format === "quote" ? "blockquote" : format;
        // In Safari/Firefox, it might be 'heading 1', in Chrome 'h1'
        if (
          currentBlock === targetBlock ||
          currentBlock ===
            (format === "quote" ? "blockquote" : `heading ${format[1]}`)
        ) {
          document.execCommand("formatBlock", false, "P");
        } else {
          document.execCommand("formatBlock", false, targetBlock.toUpperCase());
        }
      }
      syncFormatToMarkdown();
      setTimeout(() => handleSelectionChange(), 0);
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

  const handleNew = () => {
    if (window.confirm("Are you sure? Unsaved changes will be lost.")) {
      setContent("");
      setFileName("untitled.md");
      if (textareaRef.current) textareaRef.current.focus();
    }
  };

  const handleOpenClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      setContent((event.target?.result as string) || "");
      setActiveFormats([]);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSave = () => {
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
          <div className="flex items-center">
            <Logo className="h-8 w-auto text-[var(--brand-600)]" />
          </div>

          {/* View Toggles & Actions */}
          <div className="flex items-center space-x-4">
            <div className="flex bg-[var(--bg-elevated)] p-1 rounded-lg border border-[var(--border-subtle)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <button
                onClick={() => {
                  setViewMode("markdown");
                  setActiveEditor("markdown");
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all",
                  viewMode === "markdown"
                    ? "bg-[var(--bg-surface)] shadow-sm text-[var(--text-strong)] border border-[var(--border-subtle)]"
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
                    ? "bg-[var(--bg-surface)] shadow-sm text-[var(--text-strong)] border border-[var(--border-subtle)]"
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
                    ? "bg-[var(--bg-surface)] shadow-sm text-[var(--text-strong)] border border-[var(--border-subtle)]"
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
              <button
                onClick={handleSave}
                title="Save File"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md text-[var(--text-muted)] hover:text-[var(--brand-600)] hover:bg-[var(--bg-hover)] active:bg-[var(--border-subtle)] transition-colors"
              >
                <Save size={16} />
                <span className="hidden lg:inline">Save</span>
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
          {(viewMode === "markdown" || viewMode === "split") && (
            <section
              style={{ width: viewMode === "split" ? `${leftWidth}%` : "100%" }}
              className={cn(
                "flex flex-col h-full bg-[var(--bg-base)] transition-colors duration-300",
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
                  onKeyUp={handleSelectionChange}
                  onClick={handleSelectionChange}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  className="absolute inset-0 w-full h-full p-8 font-mono text-[14px] leading-8 bg-transparent text-[var(--text-strong)] resize-none editor-textarea focus:outline-none"
                  placeholder="Start typing your markdown here..."
                />
              </div>
            </section>
          )}

          {/* Resizer Handler */}
          {viewMode === "split" && (
            <div
              className="w-3 mx-[-1.5px] cursor-col-resize flex justify-center items-center z-30 group"
              onMouseDown={() => setIsResizing(true)}
              title="Drag to resize panels"
            >
              <div className="w-[1px] h-full bg-[var(--border-subtle)] group-hover:bg-[var(--brand-600)] group-hover:w-[3px] group-active:bg-[var(--brand-600)] group-active:w-[3px] transition-all"></div>
            </div>
          )}

          {/* Format Pane (Preview / WYSIWYG) */}
          {(viewMode === "format" || viewMode === "split") && (
            <section
              style={{
                width: viewMode === "split" ? `${100 - leftWidth}%` : "100%",
              }}
              className={cn(
                "flex flex-col h-full overflow-y-auto bg-[var(--bg-surface)] backdrop-blur-md transition-colors duration-300 shadow-[-4px_0_24px_rgba(0,0,0,0.04)]",
                viewMode === "split" && "flex-none",
                activeEditor === "format" && viewMode === "split"
                  ? "ring-2 ring-[var(--brand-600)]/30 ring-inset"
                  : "",
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
                  onMouseUp={handleSelectionChange}
                  onInput={syncFormatToMarkdown}
                />
              </div>
            </section>
          )}
        </main>

        {/* Status Bar */}
        <footer className="flex-none h-9 px-6 flex items-center justify-between bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider z-10 transition-colors duration-300 backdrop-blur-xl">
          <div className="flex space-x-6 items-center">
            <span className="truncate max-w-[200px] flex items-center gap-2 text-[var(--text-strong)]">
              <span className="w-4 h-4 rounded bg-[var(--brand-600)]/20 text-[var(--brand-600)] flex items-center justify-center">
                #
              </span>
              {fileName}
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
