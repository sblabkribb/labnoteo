/**
 * Date utility functions for Lab Note Editor
 * Pure functions that can be shared between Extension and Webview
 */

/**
 * Returns YYYY-MM-DD in Asia/Seoul timezone
 */
export function getSeoulDateString(date?: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date || new Date());
}

/**
 * Returns YYYY-MM-DD HH:mm in Asia/Seoul timezone (24h)
 */
export function getSeoulDateTimeString(date?: Date): string {
  const d = date || new Date();
  const datePart = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const timePart = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${datePart} ${timePart}`;
}

/**
 * Date field match result
 */
export interface DateFieldMatch {
  field: string;
  line: number;
  value: string;
  fullLine: string;
}

/**
 * Updates a date field value in a single line
 * @param line The line containing the date field
 * @param fieldName The name of the field to update (e.g., 'last_updated_date')
 * @param newDate The new date value in YYYY-MM-DD or YYYY-MM-DD HH:mm format
 * @returns The updated line, or original line if field not found
 */
export function updateDateFieldInLine(line: string, fieldName: string, newDate: string): string {
  // Match pattern: fieldName: 'value' or fieldName: "value" or fieldName: value
  const pattern = new RegExp(`(${fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}):\\s*['"]?[^'"]*['"]?`, 'i');
  if (!pattern.test(line)) {
    return line;
  }
  return line.replace(pattern, `$1: '${newDate}'`);
}

/**
 * Updates all date/datetime patterns in a single line
 * Matches dates in formats: YYYY-MM-DD or YYYY-MM-DD HH:mm
 * Handles quotes: '...', "...", or no quotes
 * @param line The line containing date patterns
 * @param newDateTime The new datetime value in YYYY-MM-DD HH:mm format
 * @returns The updated line with all dates replaced
 */
export function updateAllDatesInLine(line: string, newDateTime: string): string {
  // Date patterns:
  // - YYYY-MM-DD or YYYY-MM-DD HH:mm (hyphen separator)
  // - YYYY.MM.DD or YYYY.MM.DD. HH:mm (dot separator)
  const hyphenPattern = /\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/g;
  const dotPattern = /\d{4}\.\d{2}\.\d{2}\.?(?:\s+\d{2}:\d{2})?/g;
  
  // Find all matches from both patterns
  const matches: Array<{ start: number; end: number; quoted: boolean; quoteChar: string | null }> = [];
  
  // Helper function to process matches
  const processMatches = (pattern: RegExp) => {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      const beforeChar = start > 0 ? line[start - 1] : '';
      const afterChar = end < line.length ? line[end] : '';
      
      let quoted = false;
      let quoteChar: string | null = null;
      
      // Check if date is inside single quotes
      if (beforeChar === "'" && afterChar === "'") {
        quoted = true;
        quoteChar = "'";
      }
      // Check if date is inside double quotes
      else if (beforeChar === '"' && afterChar === '"') {
        quoted = true;
        quoteChar = '"';
      }
      
      matches.push({ start, end, quoted, quoteChar });
    }
  };
  
  // Process both patterns
  processMatches(hyphenPattern);
  processMatches(dotPattern);
  
  // Sort matches by start position to handle overlapping cases
  matches.sort((a, b) => a.start - b.start);
  
  // Remove overlapping matches (keep the first one)
  const uniqueMatches: Array<{ start: number; end: number; quoted: boolean; quoteChar: string | null }> = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    if (i === 0 || current.start >= uniqueMatches[uniqueMatches.length - 1].end) {
      uniqueMatches.push(current);
    }
  }
  
  // If no matches found, return original line
  if (uniqueMatches.length === 0) {
    return line;
  }
  
  // Replace from end to start to preserve indices
  let result = line;
  for (let i = uniqueMatches.length - 1; i >= 0; i--) {
    const { start, end, quoted, quoteChar } = uniqueMatches[i];
    
    if (quoted && quoteChar) {
      // Replace quoted date (including quotes)
      const beforeStart = start - 1;
      const afterEnd = end + 1;
      result = result.substring(0, beforeStart) + 
               `'${newDateTime}'` + 
               result.substring(afterEnd);
    } else {
      // Replace unquoted date
      result = result.substring(0, start) + 
               `'${newDateTime}'` + 
               result.substring(end);
    }
  }
  
  return result;
}

/**
 * Finds all date fields in a document
 * @param content The document content
 * @returns Array of date field matches
 */
export function findDateFieldsInDocument(content: string): DateFieldMatch[] {
  const dateFields = [
    'created_date',
    'last_updated_date',
    'end_date',
    'Start_date',
    'End_date'
  ];
  const matches: DateFieldMatch[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const field of dateFields) {
      // Match pattern: fieldName: 'value' or fieldName: "value" or fieldName: value
      const pattern = new RegExp(`(${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}):\\s*['"]?([^'"]*)['"]?`, 'i');
      const match = line.match(pattern);
      if (match) {
        matches.push({
          field: match[1],
          line: i,
          value: match[2] || '',
          fullLine: line
        });
      }
    }
  }

  return matches;
}

/**
 * Updates all occurrences of a specific date field in a document
 * @param content The document content
 * @param fieldName The name of the field to update
 * @param newDate The new date value in YYYY-MM-DD format
 * @returns The updated document content
 */
export function updateAllDateFields(content: string, fieldName: string, newDate: string): string {
  const lines = content.split('\n');
  const updatedLines = lines.map(line => updateDateFieldInLine(line, fieldName, newDate));
  return updatedLines.join('\n');
}
