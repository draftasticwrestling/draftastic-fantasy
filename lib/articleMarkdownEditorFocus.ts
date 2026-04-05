/** Scroll to and focus the end of the internal-admin Markdown body editor. */
export function focusArticleMarkdownEditorAtEnd(): void {
  const run = () => {
    const root = document.getElementById("article-markdown-editor");
    root?.scrollIntoView({ behavior: "smooth", block: "center" });
    const ta = root?.querySelector("textarea");
    if (ta instanceof HTMLTextAreaElement) {
      ta.focus();
      const len = ta.value.length;
      ta.selectionStart = len;
      ta.selectionEnd = len;
      ta.scrollTop = ta.scrollHeight;
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
  setTimeout(run, 50);
}

/** After prepending content (e.g. a hero image), focus the top of the editor. */
export function focusArticleMarkdownEditorAtStart(): void {
  const run = () => {
    const root = document.getElementById("article-markdown-editor");
    root?.scrollIntoView({ behavior: "smooth", block: "center" });
    const ta = root?.querySelector("textarea");
    if (ta instanceof HTMLTextAreaElement) {
      ta.focus();
      ta.selectionStart = 0;
      ta.selectionEnd = 0;
      ta.scrollTop = 0;
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
  setTimeout(run, 50);
}
