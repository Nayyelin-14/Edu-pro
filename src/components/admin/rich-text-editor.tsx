"use client";

import { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

const TOOLBAR_BUTTONS = [
  { type: "formatBold", icon: "format_bold", title: "Bold", command: "bold" },
  { type: "formatItalic", icon: "format_italic", title: "Italic", command: "italic" },
  { type: "formatUnderlined", icon: "format_underlined", title: "Underline", command: "underline" },
  { type: "formatListBulleted", icon: "format_list_bulleted", title: "Bullet list", command: "insertUnorderedList" },
  { type: "formatListNumbered", icon: "format_list_numbered", title: "Numbered list", command: "insertOrderedList" },
  { type: "link", icon: "link", title: "Link", command: "createLink" },
] as const;

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write your content...",
  className,
  readOnly = false,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  const handleLink = () => {
    const url = prompt("Enter URL:");
    if (url) executeCommand("createLink", url);
  };

  return (
    <div className={cn("border border-outline-variant rounded-xl overflow-hidden bg-surface-container-lowest", className)}>
      {!readOnly && (
        <div className="bg-surface-container-low border-b border-outline-variant p-2 flex flex-wrap gap-1 items-center">
          {TOOLBAR_BUTTONS.map((btn) => (
            <Button
              key={btn.type}
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 p-0"
              onClick={() => btn.command === "createLink" ? handleLink() : executeCommand(btn.command)}
              title={btn.title}
              aria-label={btn.title}
            >
              <span className="material-symbols-outlined text-[18px]">{btn.icon}</span>
            </Button>
          ))}
        </div>
      )}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onBlur={handleInput}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
        className="min-h-[200px] p-4 text-on-surface placeholder:text-outline-variant focus:outline-none"
        style={{
          minHeight: "200px",
          lineHeight: "1.6",
        }}
        data-placeholder={placeholder}
      />
      <style jsx>{`
        div[contentEditable="true"]:empty:before {
          content: attr(data-placeholder);
          color: var(--color-outline-variant);
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}