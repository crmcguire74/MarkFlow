export function detectActiveFormats(
  text: string,
  selectionStart: number,
): string[] {
  const activeFormats: string[] = [];
  if (!text) return activeFormats;

  const lastNewline = text.lastIndexOf("\n", selectionStart - 1);
  const nextNewline = text.indexOf("\n", selectionStart);

  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;

  const currentLine = text.slice(lineStart, lineEnd);
  const beforeCursorOnLine = currentLine.slice(0, selectionStart - lineStart);
  const afterCursorOnLine = currentLine.slice(selectionStart - lineStart);

  const trimmedLine = currentLine.trimStart();
  const headingMatch = trimmedLine.match(/^(#{1,6})\s/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    if (level <= 3) {
      activeFormats.push(`h${level}`);
    }
  }

  if (trimmedLine.startsWith("- ") || trimmedLine.startsWith("* "))
    activeFormats.push("ul");
  if (trimmedLine.match(/^\d+\.\s/)) activeFormats.push("ol");

  if (trimmedLine.startsWith("> ")) activeFormats.push("quote");

  if (
    (beforeCursorOnLine.split("**").length - 1) % 2 === 1 &&
    afterCursorOnLine.includes("**")
  ) {
    activeFormats.push("bold");
  }

  if (
    (beforeCursorOnLine.split("*").length - 1) % 2 === 1 &&
    afterCursorOnLine.includes("*") &&
    !activeFormats.includes("bold")
  ) {
    activeFormats.push("italic");
  }

  if (
    (beforeCursorOnLine.split("~~").length - 1) % 2 === 1 &&
    afterCursorOnLine.includes("~~")
  ) {
    activeFormats.push("strikethrough");
  }

  return activeFormats;
}

export function insertFormat(
  textarea: HTMLTextAreaElement,
  format: string,
  onChange: (value: string) => void,
  urlOpt?: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selectedText = text.substring(start, end);

  let newText = "";
  let newStart = start;
  let newEnd = end;

  const replaceSelection = (
    prefix: string,
    suffix: string,
    defaultText: string,
  ) => {
    const finalSelected = selectedText || defaultText;
    const isApplied =
      text.substring(Math.max(0, start - prefix.length), start) === prefix &&
      text.substring(end, end + suffix.length) === suffix;

    if (isApplied) {
      newText =
        text.substring(0, start - prefix.length) +
        finalSelected +
        text.substring(end + suffix.length);
      newStart = start - prefix.length;
      newEnd = newStart + finalSelected.length;
    } else {
      const replacement = `${prefix}${finalSelected}${suffix}`;
      newText = text.substring(0, start) + replacement + text.substring(end);
      newStart = start + prefix.length;
      newEnd = newStart + finalSelected.length;
    }
  };

  const toggleLinePrefix = (prefix: string) => {
    const lastNewline = text.lastIndexOf("\n", start - 1);
    const nextNewline = text.indexOf("\n", end);
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    const lineEnd = nextNewline === -1 ? text.length : nextNewline;

    let lineText = text.slice(lineStart, lineEnd);

    // Specifically handle the requested prefix toggle to avoid destroying other formatting
    // For example, if we want to toggle "# ", we only look for "# " (or any heading if prefix is heading)
    let pattern;
    if (prefix.trim().match(/^#{1,6}$/)) {
      pattern = /^(#{1,6}\s)/;
    } else if (prefix === "- " || prefix === "* ") {
      pattern = /^([-*]\s)/;
    } else if (prefix === "1. ") {
      pattern = /^(\d+\.\s)/;
    } else if (prefix === "> ") {
      pattern = /^(>\s)/;
    } else {
      pattern = new RegExp(
        `^(${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      );
    }

    const currentPrefixMatch = lineText.match(pattern);

    if (currentPrefixMatch) {
      // Remove it
      const cleanLineText = lineText.substring(currentPrefixMatch[0].length);
      newText =
        text.substring(0, lineStart) + cleanLineText + text.substring(lineEnd);
      newStart = Math.max(lineStart, start - currentPrefixMatch[0].length);
      newEnd = Math.max(lineStart, end - currentPrefixMatch[0].length);
    } else {
      // Add it
      newText =
        text.substring(0, lineStart) +
        prefix +
        lineText +
        text.substring(lineEnd);
      newStart = Math.max(lineStart, start + prefix.length);
      newEnd = Math.max(lineStart, end + prefix.length);
    }
  };

  switch (format) {
    case "bold":
      replaceSelection("**", "**", "bold text");
      break;
    case "italic":
      replaceSelection("*", "*", "italic text");
      break;
    case "strikethrough":
      replaceSelection("~~", "~~", "strikethrough");
      break;
    case "h1":
      toggleLinePrefix("# ");
      break;
    case "h2":
      toggleLinePrefix("## ");
      break;
    case "h3":
      toggleLinePrefix("### ");
      break;
    case "ul":
      toggleLinePrefix("- ");
      break;
    case "ol":
      toggleLinePrefix("1. ");
      break;
    case "quote":
      toggleLinePrefix("> ");
      break;
    case "code":
      replaceSelection("```\n", "\n```", "console.log('Hello');");
      break;
    case "link":
      replaceSelection(
        "[",
        `](${urlOpt || "https://example.com"})`,
        "Link text",
      );
      break;
    case "image":
      replaceSelection(
        "![",
        `](${urlOpt || "https://example.com/image.jpg"})`,
        "Image description",
      );
      break;
    case "table":
      replaceSelection(
        "\n| Header 1 | Header 2 |\n| -------- | -------- |\n| Cell 1   | Cell 2   |\n",
        "",
        "",
      );
      break;
    default:
      return;
  }

  // Update value
  onChange(newText);

  // Keep focus and restore selection
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(newStart, newEnd);
  }, 0);
}
