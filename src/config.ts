import * as fs from 'fs';
import * as path from 'path';
let isLoaded = false;

/**
 * Automatically discovers and loads the nearest _metadata.webergency-server.js file.
 * Only searches in the current project hierarchy (climbing up), never scans node_modules.
 */
export async function loadAutoMetadata() {
  if (isLoaded) return;
  
  const metadataFile = '_metadata.webergency-server.js';
  let currentDir = process.cwd();
  
  // Try to find the metadata file by climbing up to the project root
  while (currentDir !== path.parse(currentDir).root) {
    const fullPath = path.join(currentDir, metadataFile);
    if (fs.existsSync(fullPath)) {
      try {
        await import(`file://${fullPath}`);
        // console.log(`📡 [Webergency] Metadata loaded: ${fullPath}`);
        isLoaded = true;
        return;
      } catch (e: any) {
        console.error(`❌ Failed to load metadata: ${e.message}`);
      }
    }
    
    // Stop if we hit a package.json (don't climb past project root usually)
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
        // We still climb one level up to check if we are in a monorepo
    }
    
    currentDir = path.dirname(currentDir);
  }
}


