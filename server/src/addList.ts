import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "./firebase.js";
import { savePdf } from "./storage.js";
import { CATEGORY_VALUES, DEFAULT_CATEGORY } from "./categories.js";

const KNOWN_GENRES = [
  "Fantasy",
  "Adventure / Mystery",
  "Science Fiction",
  "Realistic Fiction",
  "Historical Fiction",
  "Nonfiction",
  "Other",
];

function printUsageAndExit(message?: string): never {
  if (message) console.error(`Error: ${message}\n`);
  console.error(
    [
      "Usage:",
      '  yarn add-list <path-to-pdf> --creator "Name" --genre "Genre" [--title "Name"] [--category popular-books|sat-vocab] [--date YYYY-MM-DD]',
      "",
      "Example:",
      '  yarn add-list ~/Downloads/wonder-vocab.pdf --creator "Mr. Alvarez" --genre "Realistic Fiction" --title "Wonder Vocabulary List"',
      "",
      "--title defaults to the PDF's filename (cleaned up) if omitted.",
      `--category defaults to "${DEFAULT_CATEGORY}" if omitted. Must be one of: ${CATEGORY_VALUES.join(", ")}.`,
      "",
      `Known genres (for consistent grouping on the site): ${KNOWN_GENRES.join(", ")}`,
      "Any other genre string is accepted too — it'll just get its own section.",
    ].join("\n")
  );
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const [pdfPath, ...rest] = argv;
  if (!pdfPath || pdfPath.startsWith("--")) {
    printUsageAndExit("missing path to a PDF file.");
  }

  const options: Record<string, string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      printUsageAndExit(`malformed argument near "${flag ?? ""}".`);
    }
    options[flag.slice(2)] = value;
  }

  if (!options.creator) printUsageAndExit("--creator is required.");
  if (!options.genre) printUsageAndExit("--genre is required.");
  if (options.category && !CATEGORY_VALUES.includes(options.category)) {
    printUsageAndExit(
      `--category must be one of: ${CATEGORY_VALUES.join(", ")}.`
    );
  }

  return {
    pdfPath,
    title: options.title,
    creator: options.creator,
    genre: options.genre,
    category: options.category || DEFAULT_CATEGORY,
    date: options.date,
  };
}

function defaultTitleFromFilename(filePath: string): string {
  return path
    .basename(filePath, path.extname(filePath))
    .replace(/[-_]+/g, " ")
    .trim();
}

async function addList() {
  const { pdfPath, title, creator, genre, category, date } = parseArgs(
    process.argv.slice(2)
  );

  const resolvedPath = path.resolve(pdfPath);
  if (!fs.existsSync(resolvedPath)) {
    printUsageAndExit(`file not found: ${resolvedPath}`);
  }
  if (path.extname(resolvedPath).toLowerCase() !== ".pdf") {
    printUsageAndExit(`not a PDF file: ${resolvedPath}`);
  }

  if (!KNOWN_GENRES.includes(genre)) {
    console.warn(
      `Note: "${genre}" isn't one of the usual genres (${KNOWN_GENRES.join(", ")}). It'll still work — it'll just get its own section on the site.`
    );
  }

  let dateUploaded: string;
  if (date) {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) printUsageAndExit(`invalid --date: ${date}`);
    dateUploaded = parsed.toISOString();
  } else {
    dateUploaded = new Date().toISOString();
  }

  const buffer = fs.readFileSync(resolvedPath);
  const originalFilename = path.basename(resolvedPath);
  const resolvedTitle = title?.trim() || defaultTitleFromFilename(resolvedPath);

  const { storagePath, fileUrl } = await savePdf(buffer, originalFilename);

  const docRef = await db.collection("lists").add({
    title: resolvedTitle,
    creator,
    genre,
    category,
    dateUploaded,
    originalFilename,
    storagePath,
    fileUrl,
    downloadCount: 0,
    published: true,
  });

  console.log(`Added "${resolvedTitle}" (${genre}, by ${creator}).`);
  console.log(`List ID: ${docRef.id}`);
  console.log("It'll show up on the View Lists page for logged-in users.");
}

addList()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to add list:", err);
    process.exit(1);
  });
