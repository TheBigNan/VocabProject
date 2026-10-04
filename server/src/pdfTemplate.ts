import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface WordEntry {
  word: string;
  definition: string;
  example: string;
}

export interface WordListContent {
  title: string;
  creator: string;
  genre: string;
  words: WordEntry[];
}

export async function buildWordListPdf(list: WordListContent): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // US Letter
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const regular = await doc.embedFont(StandardFonts.Helvetica);

  let y = 740;
  page.drawText(list.title, { x: 50, y, size: 20, font: bold });
  y -= 20;
  page.drawText(`Genre: ${list.genre}  |  Submitted by ${list.creator}`, {
    x: 50,
    y,
    size: 11,
    font: regular,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 40;

  for (const { word, definition, example } of list.words) {
    page.drawText(word, { x: 50, y, size: 14, font: bold });
    y -= 18;
    page.drawText(`Definition: ${definition}`, {
      x: 65,
      y,
      size: 11,
      font: regular,
    });
    y -= 16;
    page.drawText(`Example: ${example}`, { x: 65, y, size: 11, font: regular });
    y -= 30;
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
