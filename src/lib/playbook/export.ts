import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

/**
 * Targets the same markdown-lite subset MarkdownLite.tsx renders to screen
 * (##, -, **bold** — nothing else, see sections.ts's doc comment) but
 * produces docx Paragraph objects instead of React elements. A separate,
 * small parser rather than a shared AST with MarkdownLite.tsx: the two
 * outputs (React nodes vs docx objects) don't have a natural common shape,
 * and the line-classification logic here is short enough that sharing it
 * would cost more in indirection than it saves in duplication.
 */
function inlineRuns(text: string): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter((p) => p !== "");
  return parts.map(
    (part) =>
      new TextRun(
        part.startsWith("**") && part.endsWith("**") ? { text: part.slice(2, -2), bold: true } : { text: part }
      )
  );
}

function sectionBodyToParagraphs(text: string): Paragraph[] {
  const lines = text.split("\n");
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 }, children: inlineRuns(line.slice(3)) })
      );
    } else if (line.startsWith("- ")) {
      paragraphs.push(new Paragraph({ bullet: { level: 0 }, children: inlineRuns(line.slice(2)) }));
    } else if (line.trim() !== "") {
      paragraphs.push(new Paragraph({ spacing: { after: 80 }, children: inlineRuns(line) }));
    }
  }

  return paragraphs;
}

export type ExportSection = { title: string; content: string | null };

/**
 * Exports exactly what the Playbook page shows on screen — draft and
 * approved sections alike, no separate approval gate — since this is a
 * user-initiated "give me a file" action, not a publish step. Sections with
 * no content (never generated, or genuinely empty) are skipped rather than
 * appearing as a blank heading.
 */
export async function buildPlaybookDocx(opts: { companyName: string; sections: ExportSection[] }): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: `${opts.companyName} Sales Playbook` })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
          italics: true,
          color: "666666",
        }),
      ],
    }),
  ];

  for (const section of opts.sections) {
    if (!section.content || section.content.trim() === "") continue;
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 }, children: [new TextRun({ text: section.title })] }),
      ...sectionBodyToParagraphs(section.content)
    );
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
