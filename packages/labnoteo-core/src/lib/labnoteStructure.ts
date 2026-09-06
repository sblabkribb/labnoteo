/**
 * Labnote Structure - Functions for creating labnote folder structures
 */

import * as path from '../util/posixPath';
import { getSeoulDateString } from './dateUtils';
import { sanitizePathSegment } from './regexUtils';
import { serializeFrontMatterEntry } from '../sections/frontMatter';

/**
 * Structure returned by createLabnoteStructure
 */
export interface LabnoteStructure {
  labnoteFolder: string;
  readmePath: string;
  imagesFolder: string;
  resourcesFolder: string;
  readmeContent: string;
}

/**
 * Get the next labnote number based on existing folders
 * @param existingFolders Array of existing folder names (e.g., ['001_First', '002_Second'])
 * @returns Next number as 3-digit string (e.g., '003')
 */
export function getNextLabnoteNumber(existingFolders: string[]): string {
  const numbers = existingFolders
    .map(folder => {
      const match = folder.match(/^(\d{3})_/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  const maxNumber = numbers.length > 0 ? Math.max(...numbers) : 0;
  return String(maxNumber + 1).padStart(3, '0');
}

/**
 * Sanitize title for use as folder name
 * - Replaces spaces with underscores
 * - Removes special characters except Korean, alphanumeric, and underscores
 */
export function sanitizeTitle(title: string): string {
  return sanitizePathSegment(title);
}

/**
 * Generate README.md content for a new labnote
 * Follows labnote-lite template format
 * @param title Experiment title
 * @param author Optional author name
 */
export function generateReadmeContent(title: string, author?: string): string {
  const today = getSeoulDateString(new Date());
  
  const authorValue = author || '';

  // Front matter goes through serializeFrontMatterEntry so a title/author
  // containing a colon is emitted as valid, round-trippable YAML.
  const frontMatter = [
    serializeFrontMatterEntry('title', title),
    serializeFrontMatterEntry('author', authorValue),
    serializeFrontMatterEntry('experiment_type', 'labnote'),
    serializeFrontMatterEntry('sample_tracking', 'yes'),
    serializeFrontMatterEntry('created_date', today),
    serializeFrontMatterEntry('last_updated_date', today),
  ].join('\n');

  return `---
${frontMatter}
---

## 🎯 Experiment Objective
> Briefly describe the main objective and hypothesis of this experiment.

## 🗂️ Related Workflows

> Enter the list of related workflow files between the markers below.
> When you run the \`F1\`, \`New workflow\` command, the list will be automatically added between the markers.
> The name entered in the author: field of the YAML block above will be automatically entered as the experimenter's name when creating workflows and unit operations.



## Summary and Discussion



`;
}

export function createLabnoteStructure(
  workspaceRoot: string,
  title: string,
  existingFolders: string[],
  author?: string
): LabnoteStructure {
  const number = getNextLabnoteNumber(existingFolders);
  const sanitizedTitle = sanitizeTitle(title);
  const folderName = `${number}_${sanitizedTitle}`;
  
  const labnoteFolder = path.join(workspaceRoot, 'labnote', folderName);
  
  return {
    labnoteFolder,
    readmePath: path.join(labnoteFolder, 'README.labnote.md'),
    imagesFolder: path.join(labnoteFolder, 'images'),
    resourcesFolder: path.join(labnoteFolder, 'resources'),
    readmeContent: generateReadmeContent(title, author),
  };
}
