export interface VocabList {
  id: string;
  creator: string;
  genre: string;
  dateUploaded: string;
  originalFilename: string;
  storagePath: string;
  fileUrl: string;
  downloadCount: number;
  isPreview?: boolean;
}

export interface StatsSummary {
  visits: number;
  downloads: number;
}
