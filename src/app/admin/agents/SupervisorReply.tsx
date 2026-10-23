import { readableReplyParagraphs } from "@/lib/agent-manager/conversation-reply";

export function SupervisorReply({ text }: { text: string }) {
  const paragraphs = readableReplyParagraphs(text);
  function block(paragraph: string, index: number) {
    const lines = paragraph.split("\n").filter(line => line.trim());
    if (lines.length && lines.every(line => /^\s*(?:[-*]|\d+[.)])\s+/.test(line))) {
      return <ul key={index} className="list-disc space-y-2 pl-5">{lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "")}</li>)}</ul>;
    }
    return <p key={index} className="whitespace-pre-wrap">{paragraph}</p>;
  }
  const collapse = text.length > 1100 && paragraphs.length > 3;
  return <div className="space-y-4 break-words text-base font-normal leading-7">
    {(collapse ? paragraphs.slice(0, 2) : paragraphs).map(block)}
    {collapse ? <details><summary className="cursor-pointer text-sm font-bold text-sky-800">Show full reply</summary><div className="mt-4 space-y-4">{paragraphs.slice(2).map(block)}</div></details> : null}
  </div>;
}
