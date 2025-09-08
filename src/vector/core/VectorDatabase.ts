// Re-export the VectorDatabase from main/services
export { VectorDatabase } from '../../main/services/VectorDatabase';

// Define types locally since they're not exported from the main module
export interface SearchResult {
  id: string;
  content: string;
  score: number;
  path?: string;
  metadata?: {
    title?: string;
    path?: string;
    tags?: string[];
    createdAt?: string;
    modifiedAt?: string;
    fileType?: string;
    checksum?: string;
  };
}

export interface VectorMetadata {
  title?: string;
  path?: string;
  tags?: string[];
  createdAt?: string;
  modifiedAt?: string;
  fileType?: string;
  checksum?: string;
}