/** Renders the small markdown subset section templates emit: ## headers, - bullets, **bold**. Intentionally not a full parser — see src/lib/playbook/sections.ts. */
function inline(text: string, key: number) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span key={key}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-[var(--foreground)]">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </span>
  );
}

export function MarkdownLite({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];

  function flushList(key: number) {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={`list-${key}`} className="mt-1.5 space-y-1 text-sm leading-relaxed text-muted">
        {listBuffer.map((item, i) => (
          <li key={i}>{inline(item, i)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  }

  lines.forEach((line, i) => {
    if (line.startsWith("## ")) {
      flushList(i);
      blocks.push(
        <h3 key={i} className="mt-5 text-sm font-semibold text-[var(--foreground)] first:mt-0">
          {line.slice(3)}
        </h3>
      );
    } else if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList(i);
    } else {
      flushList(i);
      blocks.push(
        <p key={i} className="mt-1.5 text-sm leading-relaxed text-muted">
          {inline(line, i)}
        </p>
      );
    }
  });
  flushList(lines.length);

  return <div>{blocks}</div>;
}
