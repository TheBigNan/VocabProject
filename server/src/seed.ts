import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { db } from "./firebase.js";
import { savePdf, uploadsDir } from "./storage.js";
import { buildWordListPdf } from "./pdfTemplate.js";

interface FakeWord {
  word: string;
  definition: string;
  example: string;
}

interface FakeList {
  title: string;
  creator: string;
  genre: string;
  dateUploaded: string; // ISO date
  downloadCount: number;
  words: FakeWord[];
}

const FAKE_LISTS: FakeList[] = [
  {
    title: "The Lightning Thief Vocabulary List",
    creator: "Nanwang",
    genre: "Fantasy",
    dateUploaded: "2026-07-14",
    downloadCount: 34,
    words: [
      {
        word: "demigod",
        definition: "a being with one mortal and one divine parent",
        example: "Percy learns he is a demigod, the son of Poseidon.",
      },
      {
        word: "prophecy",
        definition: "a prediction of what will happen in the future",
        example: "The Oracle's prophecy hinted at a dangerous quest ahead.",
      },
      {
        word: "invincible",
        definition: "too powerful to be defeated or overcome",
        example: "Achilles was said to be nearly invincible in battle.",
      },
      {
        word: "betrayal",
        definition: "the act of being disloyal to someone who trusted you",
        example: "The betrayal by a fellow camper shocked everyone.",
      },
      {
        word: "quest",
        definition: "a long and difficult search for something",
        example: "The heroes set out on a quest to recover the master bolt.",
      },
    ],
  },
  {
    title: "Spy School Vocabulary List",
    creator: "Nanwang",
    genre: "Adventure / Mystery",
    dateUploaded: "2026-08-02",
    downloadCount: 21,
    words: [
      {
        word: "infiltrate",
        definition: "to enter a place secretly in order to gain information",
        example: "Ben was trained to infiltrate enemy headquarters.",
      },
      {
        word: "covert",
        definition: "not openly acknowledged or displayed; secret",
        example: "The agency ran a covert operation overseas.",
      },
      {
        word: "alias",
        definition: "a false or assumed identity",
        example: "Agents are given an alias before every mission.",
      },
      {
        word: "surveillance",
        definition: "close observation of a person or place",
        example: "The team kept the building under constant surveillance.",
      },
      {
        word: "decode",
        definition: "to convert a coded message into ordinary language",
        example: "It took hours to decode the encrypted file.",
      },
    ],
  },
  {
    title: "Ender's Game Vocabulary List",
    creator: "Ms. Rivera",
    genre: "Science Fiction",
    dateUploaded: "2026-06-21",
    downloadCount: 12,
    words: [
      {
        word: "strategic",
        definition: "relating to the identification of long-term goals",
        example: "Ender made a strategic decision to attack early.",
      },
      {
        word: "simulation",
        definition: "the production of a computer model of a situation",
        example: "The battle turned out to be more than just a simulation.",
      },
      {
        word: "isolation",
        definition: "the state of being separated from others",
        example: "Ender felt a deep sense of isolation among his peers.",
      },
      {
        word: "tactical",
        definition: "relating to actions planned to achieve a specific goal",
        example: "The commanders praised his tactical thinking.",
      },
      {
        word: "command",
        definition: "the authority to give orders and control others",
        example: "He was given command of his own battle unit.",
      },
    ],
  },
  {
    title: "Wonder Vocabulary List",
    creator: "Mr. Alvarez",
    genre: "Realistic Fiction",
    dateUploaded: "2026-05-30",
    downloadCount: 45,
    words: [
      {
        word: "empathy",
        definition: "the ability to understand and share the feelings of another",
        example: "Her classmates learned empathy after hearing his story.",
      },
      {
        word: "ordinary",
        definition: "with no special or distinctive features; normal",
        example: "Auggie just wanted to be treated like an ordinary kid.",
      },
      {
        word: "courage",
        definition: "the ability to do something that frightens you",
        example: "It took courage for Auggie to walk into school that day.",
      },
      {
        word: "perseverance",
        definition: "persistence in doing something despite difficulty",
        example: "His perseverance helped him make it through the year.",
      },
      {
        word: "compassion",
        definition: "sympathetic concern for the suffering of others",
        example: "Mr. Browne taught the class about compassion.",
      },
    ],
  },
  {
    title: "Number the Stars Vocabulary List",
    creator: "Ms. Chen",
    genre: "Historical Fiction",
    dateUploaded: "2026-04-11",
    downloadCount: 9,
    words: [
      {
        word: "resistance",
        definition: "the refusal to accept or comply with something",
        example: "Her family secretly joined the resistance movement.",
      },
      {
        word: "occupation",
        definition: "control of a country by a foreign military force",
        example: "Denmark was under Nazi occupation during the war.",
      },
      {
        word: "refugee",
        definition: "a person forced to leave their country to escape danger",
        example: "The family helped hide a refugee family in their home.",
      },
      {
        word: "courageous",
        definition: "not deterred by danger or pain; brave",
        example: "Annemarie made a courageous choice to help her friend.",
      },
      {
        word: "smuggle",
        definition: "to move something secretly and illegally",
        example: "They had to smuggle the family across the border.",
      },
    ],
  },
  {
    title: "I Am Malala Vocabulary List",
    creator: "Mr. Osei",
    genre: "Nonfiction",
    dateUploaded: "2026-03-19",
    downloadCount: 17,
    words: [
      {
        word: "advocate",
        definition: "a person who publicly supports a cause",
        example: "Malala became an advocate for girls' education.",
      },
      {
        word: "education",
        definition: "the process of receiving or giving systematic instruction",
        example: "She believed every child deserved an education.",
      },
      {
        word: "oppression",
        definition: "prolonged unjust treatment or control",
        example: "The book describes life under oppression in the valley.",
      },
      {
        word: "activist",
        definition: "a person who campaigns for political or social change",
        example: "She grew into one of the world's youngest activists.",
      },
      {
        word: "resilience",
        definition: "the capacity to recover quickly from difficulties",
        example: "Her resilience inspired readers around the world.",
      },
    ],
  },
];

const TOTAL_SEED_VISITS = 486;

export async function clearPreviousSeedData() {
  const snapshot = await db
    .collection("lists")
    .where("seedData", "==", true)
    .get();

  for (const doc of snapshot.docs) {
    const storagePath = doc.data().storagePath as string | undefined;
    if (storagePath?.startsWith("uploads/")) {
      const filePath = path.join(uploadsDir, path.basename(storagePath));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await doc.ref.delete();
  }

  if (snapshot.size > 0) {
    console.log(`Removed ${snapshot.size} previously seeded list(s).`);
  }
}

async function seed() {
  await clearPreviousSeedData();

  let totalDownloads = 0;

  for (const list of FAKE_LISTS) {
    const buffer = await buildWordListPdf(list);
    const originalFilename = `${list.title.replace(/\s+/g, "-")}.pdf`;
    const { storagePath, fileUrl } = await savePdf(buffer, originalFilename);

    await db.collection("lists").add({
      creator: list.creator,
      genre: list.genre,
      dateUploaded: new Date(list.dateUploaded).toISOString(),
      originalFilename,
      storagePath,
      fileUrl,
      downloadCount: list.downloadCount,
      seedData: true,
    });

    totalDownloads += list.downloadCount;
    console.log(`Seeded "${list.title}" (${list.genre}).`);
  }

  await db
    .collection("stats")
    .doc("summary")
    .set(
      { visits: TOTAL_SEED_VISITS, downloads: totalDownloads },
      { merge: true }
    );

  console.log(
    `Seeded stats: ${TOTAL_SEED_VISITS} visits, ${totalDownloads} downloads.`
  );
  console.log("Done.");
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Seeding failed:", err);
      process.exit(1);
    });
}
