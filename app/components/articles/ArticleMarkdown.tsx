"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import { ArticleLeadImage } from "./ArticleLeadImage";

function makeArticleComponents(): Components {
  let imgCount = 0;
  return {
    img: ({ node: _node, ...props }) => {
      const i = imgCount++;
      if (i === 0) {
        return <ArticleLeadImage {...props} alt={props.alt ?? ""} />;
      }
      // eslint-disable-next-line @next/next/no-img-element
      return <img {...props} alt={props.alt ?? ""} />;
    },
  };
}

export function ArticleMarkdown({ markdown }: { markdown: string }) {
  return (
    <div className="article-md">
      <ReactMarkdown components={makeArticleComponents()}>{markdown}</ReactMarkdown>
    </div>
  );
}
