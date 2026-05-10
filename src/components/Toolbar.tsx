import { cn } from "../lib/utils";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  Table,
} from "lucide-react";
import React from "react";

interface ToolbarProps {
  onFormat: (format: string) => void;
  activeFormats: string[];
  className?: string;
}

const tools = [
  {
    group: "heading",
    items: [
      { id: "h1", icon: Heading1, format: "h1", tooltip: "Heading 1" },
      { id: "h2", icon: Heading2, format: "h2", tooltip: "Heading 2" },
      { id: "h3", icon: Heading3, format: "h3", tooltip: "Heading 3" },
    ],
  },
  {
    group: "text",
    items: [
      { id: "bold", icon: Bold, format: "bold", tooltip: "Bold" },
      { id: "italic", icon: Italic, format: "italic", tooltip: "Italic" },
      { id: "strikethrough", icon: Strikethrough, format: "strikethrough", tooltip: "Strikethrough" },
    ],
  },
  {
    group: "list",
    items: [
      { id: "ul", icon: List, format: "ul", tooltip: "Bulleted List" },
      { id: "ol", icon: ListOrdered, format: "ol", tooltip: "Numbered List" },
    ],
  },
  {
    group: "blocks",
    items: [
      { id: "quote", icon: Quote, format: "quote", tooltip: "Blockquote" },
      { id: "code", icon: Code, format: "code", tooltip: "Code Block" },
    ],
  },
  {
    group: "insert",
    items: [
      { id: "link", icon: Link2, format: "link", tooltip: "Link" },
      { id: "image", icon: ImageIcon, format: "image", tooltip: "Image" },
      { id: "table", icon: Table, format: "table", tooltip: "Table" },
    ],
  },
];

export function Toolbar({ onFormat, activeFormats, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1 p-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] backdrop-blur-xl relative z-10",
        className
      )}
    >
      {tools.map((group, groupIndex) => (
        <React.Fragment key={group.group}>
          <div className="flex items-center gap-1 px-1">
            {group.items.map((tool) => {
              const isActive = activeFormats.includes(tool.format);
              return (
                <button
                  key={tool.id}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onFormat(tool.format)}
                  title={tool.tooltip}
                  className={cn(
                    "p-1.5 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand-600)]",
                    isActive
                      ? "bg-[var(--brand-600)] text-white shadow-md shadow-[var(--brand-600)]/20"
                      : "text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-hover)] active:bg-[var(--border-subtle)]"
                  )}
                >
                  <tool.icon size={16} />
                </button>
              );
            })}
          </div>
          {groupIndex < tools.length - 1 && (
            <div className="w-[1px] h-5 bg-[var(--border-subtle)] mx-1" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
