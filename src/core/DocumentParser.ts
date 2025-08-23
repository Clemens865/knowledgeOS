import * as fs from 'fs/promises';
import * as path from 'path';

interface ParsedDocument {
  title: string;
  content: string;
  metadata: {
    format: string;
    size: number;
    created: string;
    modified: string;
    pageCount?: number;
    author?: string;
  };
  sections: DocumentSection[];
  images?: ImageData[];
  tables?: TableData[];
}

interface DocumentSection {
  heading: string;
  content: string;
  level: number;
}

interface ImageData {
  name: string;
  caption?: string;
  data: string; // base64
}

interface TableData {
  headers: string[];
  rows: string[][];
  caption?: string;
}

export class DocumentParser {
  private supportedFormats = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.txt', '.md', '.csv', '.json', '.xml',
    '.rtf', '.odt', '.ods', '.ppt', '.pptx'
  ];

  async parseDocument(filePath: string): Promise<ParsedDocument> {
    const ext = path.extname(filePath).toLowerCase();
    
    if (!this.supportedFormats.includes(ext)) {
      throw new Error(`Unsupported file format: ${ext}`);
    }
    
    const stats = await fs.stat(filePath);
    const baseMetadata = {
      format: ext,
      size: stats.size,
      created: stats.birthtime.toISOString(),
      modified: stats.mtime.toISOString()
    };
    
    switch (ext) {
      case '.txt':
      case '.md':
        return this.parseTextFile(filePath, baseMetadata);
      case '.pdf':
        return this.parsePDF(filePath, baseMetadata);
      case '.docx':
      case '.doc':
        return this.parseWord(filePath, baseMetadata);
      case '.xlsx':
      case '.xls':
        return this.parseExcel(filePath, baseMetadata);
      case '.csv':
        return this.parseCSV(filePath, baseMetadata);
      case '.json':
        return this.parseJSON(filePath, baseMetadata);
      default:
        return this.parseGeneric(filePath, baseMetadata);
    }
  }

  private async parseTextFile(filePath: string, metadata: any): Promise<ParsedDocument> {
    const content = await fs.readFile(filePath, 'utf-8');
    const title = path.basename(filePath, path.extname(filePath));
    
    // Extract sections if markdown
    const sections = this.extractMarkdownSections(content);
    
    return {
      title,
      content,
      metadata,
      sections: sections.length > 0 ? sections : [{
        heading: title,
        content,
        level: 1
      }]
    };
  }

  private extractMarkdownSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const lines = content.split('\n');
    let currentSection: DocumentSection | null = null;
    let currentContent: string[] = [];
    
    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      
      if (headingMatch) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          heading: headingMatch[2],
          content: '',
          level: headingMatch[1].length
        };
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    
    // Save last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }
    
    return sections;
  }

  private async parsePDF(filePath: string, metadata: any): Promise<ParsedDocument> {
    // For now, we'll create a placeholder implementation
    // In production, you'd use a library like pdf-parse or pdfjs-dist
    const title = path.basename(filePath, '.pdf');
    
    return {
      title,
      content: `PDF document: ${title}\n\nPDF parsing will be implemented with pdf-parse library.`,
      metadata: {
        ...metadata,
        pageCount: 0 // Would be extracted from PDF
      },
      sections: [{
        heading: title,
        content: 'PDF content would be extracted here',
        level: 1
      }]
    };
  }

  private async parseWord(filePath: string, metadata: any): Promise<ParsedDocument> {
    // Placeholder for Word document parsing
    // In production, use mammoth or docx library
    const title = path.basename(filePath, path.extname(filePath));
    
    return {
      title,
      content: `Word document: ${title}\n\nWord parsing will be implemented with mammoth library.`,
      metadata,
      sections: [{
        heading: title,
        content: 'Word content would be extracted here',
        level: 1
      }]
    };
  }

  private async parseExcel(filePath: string, metadata: any): Promise<ParsedDocument> {
    // Placeholder for Excel parsing
    // In production, use xlsx or exceljs library
    const title = path.basename(filePath, path.extname(filePath));
    
    return {
      title,
      content: `Excel document: ${title}\n\nExcel parsing will be implemented with xlsx library.`,
      metadata,
      sections: [{
        heading: title,
        content: 'Excel data would be extracted here',
        level: 1
      }],
      tables: [] // Would contain extracted tables
    };
  }

  private async parseCSV(filePath: string, metadata: any): Promise<ParsedDocument> {
    const content = await fs.readFile(filePath, 'utf-8');
    const title = path.basename(filePath, '.csv');
    
    // Parse CSV content
    const lines = content.split('\n').filter(line => line.trim());
    const headers = lines[0]?.split(',').map(h => h.trim()) || [];
    const rows = lines.slice(1).map(line => 
      line.split(',').map(cell => cell.trim())
    );
    
    // Convert to markdown table
    let markdownTable = '| ' + headers.join(' | ') + ' |\n';
    markdownTable += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    for (const row of rows) {
      markdownTable += '| ' + row.join(' | ') + ' |\n';
    }
    
    return {
      title,
      content: markdownTable,
      metadata,
      sections: [{
        heading: title,
        content: markdownTable,
        level: 1
      }],
      tables: [{
        headers,
        rows,
        caption: title
      }]
    };
  }

  private async parseJSON(filePath: string, metadata: any): Promise<ParsedDocument> {
    const content = await fs.readFile(filePath, 'utf-8');
    const title = path.basename(filePath, '.json');
    
    try {
      const data = JSON.parse(content);
      const formatted = JSON.stringify(data, null, 2);
      
      // Convert to markdown code block
      const markdownContent = '```json\n' + formatted + '\n```';
      
      return {
        title,
        content: markdownContent,
        metadata,
        sections: this.extractJSONSections(data, title)
      };
    } catch (error) {
      throw new Error(`Invalid JSON file: ${error}`);
    }
  }

  private extractJSONSections(data: any, title: string): DocumentSection[] {
    const sections: DocumentSection[] = [{
      heading: title,
      content: 'JSON Data Structure',
      level: 1
    }];
    
    // Extract top-level keys as sections
    if (typeof data === 'object' && data !== null) {
      for (const [key, value] of Object.entries(data)) {
        sections.push({
          heading: key,
          content: typeof value === 'object' 
            ? '```json\n' + JSON.stringify(value, null, 2) + '\n```'
            : String(value),
          level: 2
        });
      }
    }
    
    return sections;
  }

  private async parseGeneric(filePath: string, metadata: any): Promise<ParsedDocument> {
    const title = path.basename(filePath, path.extname(filePath));
    
    try {
      // Try to read as text
      const content = await fs.readFile(filePath, 'utf-8');
      return {
        title,
        content,
        metadata,
        sections: [{
          heading: title,
          content,
          level: 1
        }]
      };
    } catch {
      // Binary file
      return {
        title,
        content: `Binary file: ${title}`,
        metadata,
        sections: [{
          heading: title,
          content: 'Binary content cannot be displayed as text',
          level: 1
        }]
      };
    }
  }

  async convertToMarkdown(parsed: ParsedDocument): Promise<string> {
    let markdown = `# ${parsed.title}\n\n`;
    
    // Add metadata
    markdown += `---\n`;
    markdown += `**Format:** ${parsed.metadata.format}\n`;
    markdown += `**Size:** ${this.formatFileSize(parsed.metadata.size)}\n`;
    markdown += `**Modified:** ${new Date(parsed.metadata.modified).toLocaleString()}\n`;
    if (parsed.metadata.author) {
      markdown += `**Author:** ${parsed.metadata.author}\n`;
    }
    if (parsed.metadata.pageCount) {
      markdown += `**Pages:** ${parsed.metadata.pageCount}\n`;
    }
    markdown += `---\n\n`;
    
    // Add sections
    for (const section of parsed.sections) {
      const heading = '#'.repeat(Math.min(section.level, 6));
      markdown += `${heading} ${section.heading}\n\n`;
      markdown += `${section.content}\n\n`;
    }
    
    // Add tables if present
    if (parsed.tables && parsed.tables.length > 0) {
      markdown += `## Data Tables\n\n`;
      for (const table of parsed.tables) {
        if (table.caption) {
          markdown += `### ${table.caption}\n\n`;
        }
        markdown += '| ' + table.headers.join(' | ') + ' |\n';
        markdown += '| ' + table.headers.map(() => '---').join(' | ') + ' |\n';
        for (const row of table.rows) {
          markdown += '| ' + row.join(' | ') + ' |\n';
        }
        markdown += '\n';
      }
    }
    
    // Add footer
    markdown += `---\n`;
    markdown += `*Imported from ${parsed.metadata.format} file on ${new Date().toLocaleString()}*\n`;
    
    return markdown;
  }

  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  async extractKeywordsFromDocument(parsed: ParsedDocument): Promise<string[]> {
    const text = parsed.content.toLowerCase();
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but']);
    
    // Extract words
    const words = text
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));
    
    // Count frequency
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
    
    // Return top keywords
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
}