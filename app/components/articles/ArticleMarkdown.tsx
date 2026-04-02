"use client";

import ReactMarkdown from "react-markdown";

export function ArticleMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="article-md">
      <ReactMarkdown>{markdown}</ReactMarkdown>
    </div>
  );
}
