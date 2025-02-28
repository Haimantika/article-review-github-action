#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get all markdown files from the repository
const getAllMarkdownFiles = (dir, fileList = []) => {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllMarkdownFiles(filePath, fileList);
    } else if (file.endsWith('.md')) {
      fileList.push(filePath);
    }
  });
  
  return fileList;
};

// Validate headers structure (should follow proper hierarchy)
const validateHeaderStructure = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const headerLevels = [];
  const yamlSection = content.startsWith('---');
  let inYamlSection = yamlSection;
  let valid = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip YAML front matter
    if (line === '---') {
      inYamlSection = !inYamlSection;
      continue;
    }
    
    if (inYamlSection) {
      continue;
    }
    
    // Check if line is a header
    if (line.startsWith('#')) {
      const level = line.match(/^#+/)[0].length;
      
      // First header should be level 1 or 2
      if (headerLevels.length === 0 && level > 2) {
        console.error(`❌ ${filePath}:${i+1}: First header should be level 1 or 2, found level ${level}`);
        valid = false;
      }
      
      // Headers should not skip levels (e.g., H2 -> H4)
      if (headerLevels.length > 0 && level > headerLevels[headerLevels.length - 1] + 1) {
        console.error(`❌ ${filePath}:${i+1}: Header level skipped from ${headerLevels[headerLevels.length - 1]} to ${level}`);
        valid = false;
      }
      
      // Check header format: exactly one space after #
      const headerFormat = line.match(/^#+\s/);
      if (!headerFormat || line.match(/^#+\s\s+/)) {
        console.error(`❌ ${filePath}:${i+1}: Header format error: should have exactly one space after #: "${line}"`);
        valid = false;
      }
      
      headerLevels.push(level);
    }
  }
  
  return valid;
};

// Check for trailing whitespace and extra spaces
const validateWhitespace = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let valid = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for trailing whitespace
    if (line.match(/\s+$/)) {
      console.error(`❌ ${filePath}:${i+1}: Line has trailing whitespace: "${line}"`);
      valid = false;
    }
    
    // Check for multiple spaces in text (excluding code blocks and front matter)
    if (!line.startsWith('    ') && !line.startsWith('```') && !line.match(/^#+\s/) && !line.match(/^\s*-\s/) && !line.match(/^\|/) && line.match(/\S\s{2,}\S/)) {
      console.error(`❌ ${filePath}:${i+1}: Line has extra spaces: "${line}"`);
      valid = false;
    }
  }
  
  // Check if file ends with a single newline
  if (!content.endsWith('\n') || content.endsWith('\n\n')) {
    console.error(`❌ ${filePath}: File should end with a single newline character`);
    valid = false;
  }
  
  return valid;
};

// Main validation function
const validateMarkdownFiles = () => {
  const markdownFiles = getAllMarkdownFiles('.');
  let allValid = true;
  
  console.log(`Found ${markdownFiles.length} markdown files to validate`);
  
  for (const file of markdownFiles) {
    console.log(`\nValidating ${file}...`);
    
    const headerStructureValid = validateHeaderStructure(file);
    const whitespaceValid = validateWhitespace(file);
    
    const fileValid = headerStructureValid && whitespaceValid;
    
    if (fileValid) {
      console.log(`✅ ${file}: All checks passed`);
    } else {
      allValid = false;
    }
  }
  
  return allValid;
};

// Run validation
const allValid = validateMarkdownFiles();

if (!allValid) {
  console.error('\n❌ Validation failed');
  process.exit(1);
} else {
  console.log('\n✅ All markdown files validated successfully');
}