"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

function makeArticleComponents(): Components {
  let imgCount = 0;
  return {
    img: ({ node: _node, ...props }) => {
      const i = imgCount++;
      if (i === 0) {
        return (
          <div className="article-md-hero-img-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img {...props} alt={props.alt ?? ""} />
          </div>
        );
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
