#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yamlFront = require('yaml-front-matter');

// Configuration - customize based on your requirements
const requiredFrontMatterFields = [
  'title',
  'description',
  'state',
  'language',
  'authors',
  'primary_tag',
  'tags'
];

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

// Validate front matter
const validateFrontMatter = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  let frontMatter;
  
  try {
    frontMatter = yamlFront.loadFront(content);
  } catch (error) {
    console.error(`❌ ${filePath}: Invalid YAML front matter: ${error.message}`);
    return false;
  }
  
  // Check required fields
  let valid = true;
  for (const field of requiredFrontMatterFields) {
    if (!frontMatter[field]) {
      console.error(`❌ ${filePath}: Missing required front matter field '${field}'`);
      valid = false;
    }
  }
  
  // Validate specific field formats
  if (frontMatter.tags && !Array.isArray(frontMatter.tags)) {
    console.error(`❌ ${filePath}: 'tags' must be an array`);
    valid = false;
  }
  
  if (frontMatter.authors && !Array.isArray(frontMatter.authors)) {
    console.error(`❌ ${filePath}: 'authors' must be an array`);
    valid = false;
  }
  
  if (frontMatter.state && !['published', 'draft', 'review'].includes(frontMatter.state)) {
    console.error(`❌ ${filePath}: 'state' must be one of: published, draft, review`);
    valid = false;
  }
  
  return valid;
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
      
      headerLevels.push(level);
    }
  }
  
  return valid;
};

// Validate code blocks (properly formatted and closed)
const validateCodeBlocks = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let inCodeBlock = false;
  let codeBlockStart = 0;
  let codeBlockLanguage = '';
  let valid = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockStart = i;
        
        // Check if language is specified
        codeBlockLanguage = line.trim().replace('```', '');
        if (codeBlockLanguage.trim() === '') {
          console.warn(`⚠️ ${filePath}:${i+1}: Code block without language specification`);
        }
      }
    }
  }
  
  if (inCodeBlock) {
    console.error(`❌ ${filePath}:${codeBlockStart+1}: Unclosed code block starting with \`\`\`${codeBlockLanguage}`);
    valid = false;
  }
  
  return valid;
};

// Validate links (proper format and no broken relative links)
const validateLinks = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const htmlLinkRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>/g;
  let match;
  let valid = true;
  
  // Check Markdown style links
  while ((match = markdownLinkRegex.exec(content)) !== null) {
    const [fullMatch, text, url] = match;
    
    // Check for empty link text
    if (!text.trim()) {
      console.error(`❌ ${filePath}: Empty link text in "${fullMatch}"`);
      valid = false;
    }
    
    // Check for local file links that don't exist
    if (url.startsWith('./') || url.startsWith('../') || (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/#'))) {
      try {
        const localPath = url.startsWith('/') 
          ? path.join(process.cwd(), url) 
          : path.join(path.dirname(filePath), url);
        
        if (!fs.existsSync(localPath)) {
          console.error(`❌ ${filePath}: Broken local link "${url}"`);
          valid = false;
        }
      } catch (error) {
        console.error(`❌ ${filePath}: Error checking local link "${url}": ${error.message}`);
        valid = false;
      }
    }
  }
  
  // Check HTML style links
  while ((match = htmlLinkRegex.exec(content)) !== null) {
    const url = match[1];
    
    // Check for local file links that don't exist
    if (url.startsWith('./') || url.startsWith('../') || (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/#'))) {
      try {
        const localPath = url.startsWith('/') 
          ? path.join(process.cwd(), url) 
          : path.join(path.dirname(filePath), url);
        
        if (!fs.existsSync(localPath)) {
          console.error(`❌ ${filePath}: Broken local link "${url}"`);
          valid = false;
        }
      } catch (error) {
        console.error(`❌ ${filePath}: Error checking local link "${url}": ${error.message}`);
        valid = false;
      }
    }
  }
  
  return valid;
};

// Validate tables (properly formatted)
const validateTables = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let inTable = false;
  let tableStartLine = 0;
  let headerSeparatorFound = false;
  let columnCount = 0;
  let valid = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableStartLine = i;
        columnCount = (line.match(/\|/g) || []).length - 1;
      } else {
        // Check if this is the header separator row
        if (line.replace(/\|/g, '').trim().replace(/\s/g, '').replace(/-/g, '').replace(/:/g, '') === '') {
          headerSeparatorFound = true;
          
          // Validate separator format
          const separators = line.split('|').filter(Boolean);
          for (const separator of separators) {
            if (!separator.trim().match(/^:?-+:?$/)) {
              console.error(`❌ ${filePath}:${i+1}: Invalid table header separator "${separator}"`);
              valid = false;
            }
          }
        } else {
          // Check if all rows have the same number of columns
          const currentColumnCount = (line.match(/\|/g) || []).length - 1;
          if (currentColumnCount !== columnCount) {
            console.error(`❌ ${filePath}:${i+1}: Table row has ${currentColumnCount} columns, expected ${columnCount}`);
            valid = false;
          }
        }
      }
    } else if (inTable && line === '') {
      // End of table
      inTable = false;
      
      // Check if table had header separator
      if (!headerSeparatorFound) {
        console.error(`❌ ${filePath}:${tableStartLine+1}: Table missing header separator row`);
        valid = false;
      }
      
      headerSeparatorFound = false;
    }
  }
  
  return valid;
};

// Validate image references
const validateImages = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const htmlImageRegex = /<img\s+(?:[^>]*?\s+)?src="([^"]*)"[^>]*>/g;
  let match;
  let valid = true;
  
  // Check Markdown style images
  while ((match = imageRegex.exec(content)) !== null) {
    const [fullMatch, altText, url] = match;
    
    // Check for empty alt text
    if (!altText.trim()) {
      console.warn(`⚠️ ${filePath}: Missing alt text in image "${fullMatch}"`);
    }
    
    // Check for local images that don't exist
    if (url.startsWith('./') || url.startsWith('../') || (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/#'))) {
      try {
        const localPath = url.startsWith('/') 
          ? path.join(process.cwd(), url) 
          : path.join(path.dirname(filePath), url);
        
        if (!fs.existsSync(localPath)) {
          console.error(`❌ ${filePath}: Broken local image link "${url}"`);
          valid = false;
        }
      } catch (error) {
        console.error(`❌ ${filePath}: Error checking local image link "${url}": ${error.message}`);
        valid = false;
      }
    }
  }
  
  // Check HTML style images
  while ((match = htmlImageRegex.exec(content)) !== null) {
    const url = match[1];
    
    // Check for local images that don't exist
    if (url.startsWith('./') || url.startsWith('../') || (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/#'))) {
      try {
        const localPath = url.startsWith('/') 
          ? path.join(process.cwd(), url) 
          : path.join(path.dirname(filePath), url);
        
        if (!fs.existsSync(localPath)) {
          console.error(`❌ ${filePath}: Broken local image link "${url}"`);
          valid = false;
        }
      } catch (error) {
        console.error(`❌ ${filePath}: Error checking local image link "${url}": ${error.message}`);
        valid = false;
      }
    }
  }
  
  return valid;
};

// Validate custom callouts/notes format
const validateCallouts = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  let inCallout = false;
  let calloutStartLine = 0;
  let valid = true;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.trim().startsWith('<$>')) {
      if (!inCallout) {
        inCallout = true;
        calloutStartLine = i;
      } else {
        inCallout = false;
      }
    }
  }
  
  if (inCallout) {
    console.error(`❌ ${filePath}:${calloutStartLine+1}: Unclosed callout block`);
    valid = false;
  }
  
  return valid;
};

// Check secondary labels correct format
const validateSecondaryLabels = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const secondaryLabelRegex = /\[secondary_label\s+(.*?)\]/g;
  let match;
  let valid = true;
  
  while ((match = secondaryLabelRegex.exec(content)) !== null) {
    const label = match[1].trim();
    if (!label) {
      console.error(`❌ ${filePath}: Empty secondary label`);
      valid = false;
    }
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
    
    const frontMatterValid = validateFrontMatter(file);
    const headerStructureValid = validateHeaderStructure(file);
    const codeBlocksValid = validateCodeBlocks(file);
    const linksValid = validateLinks(file);
    const tablesValid = validateTables(file);
    const imagesValid = validateImages(file);
    const calloutsValid = validateCallouts(file);
    const secondaryLabelsValid = validateSecondaryLabels(file);
    
    const fileValid = frontMatterValid && 
                      headerStructureValid && 
                      codeBlocksValid && 
                      linksValid && 
                      tablesValid && 
                      imagesValid && 
                      calloutsValid && 
                      secondaryLabelsValid;
    
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