#!/usr/bin/env node
/**
 * Post-build script to add .js extensions to relative imports in compiled ESM files
 * This is required because Node.js ESM requires explicit file extensions
 */

const fs = require('fs');
const path = require('path');

function fixImportsInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Match relative imports like: import ... from './something' or from '../something'
  // Match both single and double quotes, and handle various import styles
  const importRegex = /from\s+['"](\.\.?\/[^'"]+?)['"]/g;
  
  const newContent = content.replace(importRegex, (match, importPath) => {
    // Skip if it already has a file extension (like .js, .json, .mjs, etc.)
    if (importPath.match(/\.\w+$/)) {
      return match;
    }
    // Skip if it's a directory import (ends with /)
    if (importPath.endsWith('/')) {
      return match;
    }
    // Skip if it's an index file (we'll import from directory)
    if (importPath.endsWith('/index')) {
      return match;
    }
    modified = true;
    return match.replace(importPath, importPath + '.js');
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Fixed imports in: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.js') && !file.endsWith('.map')) {
      fixImportsInFile(filePath);
    }
  }
}

const distDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distDir)) {
  console.log('Fixing ESM imports in dist directory...');
  walkDir(distDir);
  console.log('Done fixing ESM imports.');
} else {
  console.error('Dist directory not found:', distDir);
  process.exit(1);
}

