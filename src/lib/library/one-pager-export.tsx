import { Document, Page, Text, View, Image, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import PptxGenJS from "pptxgenjs";

export type OnePager = {
  id: string;
  headline: string;
  subheadline: string;
  value_bullets: string;
  proof_point: string;
  cta: string;
};

export type BrandTokens = {
  logo: string;
  colorPrimary: string;
  colorSecondary: string;
};

function bulletLines(value_bullets: string): string[] {
  return value_bullets
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

// Font.register isn't needed — the default Helvetica family react-pdf ships
// with is enough for a one-pager; no custom brand typeface is captured
// anywhere in org.brand today (font_heading/font_body are always blank —
// see extractBrandKit's doc comment), so there's nothing real to register.
const pdfStyles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: "#1e293b" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  logo: { width: 28, height: 28, objectFit: "contain" },
  headline: { fontSize: 22, fontWeight: 700 },
  subheadline: { fontSize: 12, color: "#475569", marginBottom: 16 },
  bulletRow: { flexDirection: "row", marginBottom: 6, alignItems: "flex-start" },
  bulletDot: { width: 5, height: 5, borderRadius: 2.5, marginTop: 4, marginRight: 8 },
  bulletText: { flex: 1, fontSize: 11, lineHeight: 1.4 },
  proofBox: { borderRadius: 8, padding: 12, marginTop: 14, fontSize: 10, lineHeight: 1.4 },
  cta: { fontSize: 12, fontWeight: 700, marginTop: 14 },
});

/**
 * A one-pager is a preview of a document meant to be sent or printed, so
 * unlike the app's own UI it doesn't need theme-awareness — a PDF page is
 * already its own fixed white canvas, no dark-mode equivalent to fight
 * (see the Library page's own doc comment for the analogous bug this
 * avoided there).
 */
export async function buildOnePagerPdf(onePager: OnePager, brand: BrandTokens): Promise<Buffer> {
  const doc = (
    <Document>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.headerRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image renders into a PDF, not the DOM; it has no `alt` prop, the rule is a false positive here */}
          {brand.logo && <Image src={brand.logo} style={pdfStyles.logo} />}
          <Text style={pdfStyles.headline}>{onePager.headline}</Text>
        </View>
        <Text style={pdfStyles.subheadline}>{onePager.subheadline}</Text>
        {bulletLines(onePager.value_bullets).map((line, i) => (
          <View key={i} style={pdfStyles.bulletRow}>
            <View style={[pdfStyles.bulletDot, { backgroundColor: brand.colorPrimary }]} />
            <Text style={pdfStyles.bulletText}>{line}</Text>
          </View>
        ))}
        <View style={[pdfStyles.proofBox, { backgroundColor: brand.colorSecondary }]}>
          <Text>{onePager.proof_point}</Text>
        </View>
        <Text style={[pdfStyles.cta, { color: brand.colorPrimary }]}>{onePager.cta}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}

// react-pdf's Font.register is a no-op call reference to keep the import
// used if a real brand typeface is ever added — deliberately unused today.
void Font;

/**
 * A one-pager is exactly the shape a single branded slide fits — headline,
 * subheadline, bullets, one proof point, a CTA — so this is one slide, not
 * a deck, matching the marketing site's own framing (a one-pager, not a
 * multi-slide deck).
 */
export async function buildOnePagerPptx(onePager: OnePager, brand: BrandTokens): Promise<Buffer> {
  // pptxgenjs color options take a bare hex string ("1E293B"), not CSS
  // notation ("#1E293B") — org.brand's colors are stored with the "#"
  // (react-pdf and the app's own CSS both accept that form directly, but
  // pptxgenjs doesn't), so every brand color needs stripping once here
  // rather than scattered .replace() calls at each call site.
  const primary = brand.colorPrimary.replace("#", "");
  const secondary = brand.colorSecondary.replace("#", "");

  const pres = new PptxGenJS();
  pres.defineLayout({ name: "ONE_PAGER", width: 10, height: 7.5 });
  pres.layout = "ONE_PAGER";

  const slide = pres.addSlide();
  slide.background = { color: "FFFFFF" };
  slide.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 10, h: 0.12, fill: { color: primary } });

  let y = 0.5;
  if (brand.logo) {
    try {
      slide.addImage({ path: brand.logo, x: 0.5, y, w: 0.5, h: 0.5 });
    } catch {
      // A bad/unreachable logo URL shouldn't fail the whole export — the
      // slide is still useful without it, same "degrade, don't crash"
      // posture as everything else touching a scraped external asset.
    }
  }
  slide.addText(onePager.headline, {
    x: brand.logo ? 1.2 : 0.5,
    y,
    w: 8.3,
    h: 0.6,
    fontSize: 28,
    bold: true,
    color: "1E293B",
    fontFace: "Helvetica",
  });
  y += 0.85;

  slide.addText(onePager.subheadline, {
    x: 0.5,
    y,
    w: 9,
    h: 0.6,
    fontSize: 14,
    color: "475569",
    fontFace: "Helvetica",
  });
  y += 0.9;

  slide.addText(
    bulletLines(onePager.value_bullets).map((line) => ({ text: line, options: { breakLine: true, bullet: { code: "25CF", indent: 20 } } })),
    { x: 0.5, y, w: 9, h: 2.4, fontSize: 13, color: "1E293B", fontFace: "Helvetica", valign: "top" }
  );
  y += 2.6;

  slide.addShape(pres.ShapeType.roundRect, {
    x: 0.5,
    y,
    w: 9,
    h: 0.9,
    fill: { color: secondary },
    line: { type: "none" },
    rectRadius: 0.08,
  });
  slide.addText(onePager.proof_point, {
    x: 0.7,
    y: y + 0.08,
    w: 8.6,
    h: 0.74,
    fontSize: 11,
    color: "1E293B",
    fontFace: "Helvetica",
    valign: "middle",
  });
  y += 1.1;

  slide.addText(onePager.cta, {
    x: 0.5,
    y,
    w: 9,
    h: 0.5,
    fontSize: 14,
    bold: true,
    color: primary,
    fontFace: "Helvetica",
  });

  const buffer = await pres.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}
