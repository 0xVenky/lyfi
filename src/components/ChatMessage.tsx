"use client";

type Props = {
  role: "user" | "assistant";
  content: string;
};

export function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-violet-600 text-white rounded-br-md"
            : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose-chat">
            <MarkdownLite text={content} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Minimal markdown renderer — headers, bold, lists, blockquotes, tables.
 */
function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimStart();

    // Blank line → spacer
    if (trimmed === "") {
      elements.push(<div key={key++} className="h-2" />);
      i++;
      continue;
    }

    // Table block
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      elements.push(<MarkdownTable key={key++} lines={tableLines} />);
      continue;
    }

    // Blockquote block
    if (trimmed.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("> ")) {
        quoteLines.push(lines[i].trimStart().slice(2));
        i++;
      }
      elements.push(
        <blockquote key={key++} className="border-l-3 border-violet-300 pl-3 my-2 text-gray-600 italic">
          {quoteLines.map((ql, qi) => (
            <span key={qi}>{qi > 0 && <br />}<InlineMarkdown text={ql} /></span>
          ))}
        </blockquote>
      );
      continue;
    }

    // Bullet list block
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const items: { indent: number; text: string }[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const t = l.trimStart();
        if (t.startsWith("- ") || t.startsWith("* ")) {
          items.push({ indent: l.length - t.length, text: t.slice(2) });
          i++;
        } else {
          break;
        }
      }
      const baseIndent = items[0]?.indent ?? 0;
      elements.push(
        <ul key={key++} className="my-1.5 space-y-0.5">
          {items.map((item, idx) => (
            <li
              key={idx}
              className="flex gap-1.5"
              style={{ paddingLeft: `${Math.max(0, (item.indent - baseIndent) / 2) * 12}px` }}
            >
              <span className="text-gray-400 shrink-0">•</span>
              <span><InlineMarkdown text={item.text} /></span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list block
    if (/^\d+[.)]\s/.test(trimmed)) {
      const items: { num: string; text: string }[] = [];
      while (i < lines.length) {
        const t = lines[i].trimStart();
        const match = t.match(/^(\d+)[.)]\s(.*)$/);
        if (match) {
          items.push({ num: match[1], text: match[2] });
          i++;
        } else {
          break;
        }
      }
      elements.push(
        <ol key={key++} className="my-1.5 space-y-0.5">
          {items.map((item, idx) => (
            <li key={idx} className="flex gap-1.5">
              <span className="text-gray-400 shrink-0 font-medium tabular-nums">{item.num}.</span>
              <span><InlineMarkdown text={item.text} /></span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Headers
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="font-semibold text-gray-900 mt-3 mb-1">
          <InlineMarkdown text={trimmed.slice(4)} />
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="font-semibold text-gray-900 text-[15px] mt-3 mb-1">
          <InlineMarkdown text={trimmed.slice(3)} />
        </h2>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="font-bold text-gray-900 text-base mt-3 mb-1">
          <InlineMarkdown text={trimmed.slice(2)} />
        </h1>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(<hr key={key++} className="border-gray-200 my-2" />);
      i++;
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="my-0.5">
        <InlineMarkdown text={line} />
      </p>
    );
    i++;
  }

  return <>{elements}</>;
}

/** Inline markdown: **bold**, `code`, [links] */
function InlineMarkdown({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return <code key={i} className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono text-violet-700">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function MarkdownTable({ lines }: { lines: string[] }) {
  const parseRow = (line: string) =>
    line.split("|").slice(1, -1).map((cell) => cell.trim());

  const dataRows = lines.filter((l) => !/^\|[\s\-:|]+\|$/.test(l));
  if (dataRows.length === 0) return null;

  const header = parseRow(dataRows[0]);
  const body = dataRows.slice(1).map(parseRow);

  return (
    <div className="overflow-x-auto my-2 rounded-lg border border-gray-200">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-gray-50">
            {header.map((cell, i) => (
              <th key={i} className="border-b border-gray-200 px-3 py-1.5 text-left font-medium text-gray-600">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 1 ? "bg-gray-50/50" : ""}>
              {row.map((cell, ci) => (
                <td key={ci} className="border-b border-gray-100 px-3 py-1.5 text-gray-700">
                  <InlineMarkdown text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
