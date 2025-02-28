// Get all markdown files from the repository
const getAllMarkdownFiles = (dir, fileList = [], excludeDirs = ['node_modules', '.git']) => {
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
      const filePath = path.join(dir, file);
      
      // Skip excluded directories
      if (fs.statSync(filePath).isDirectory()) {
        if (!excludeDirs.includes(file)) {
          getAllMarkdownFiles(filePath, fileList, excludeDirs);
        }
      } else if (file.endsWith('.md')) {
        fileList.push(filePath);
      }
    });
    
    return fileList;
  };
  
  const fs = require('fs');
  const path = require('path');
  const axios = require('axios');
  
  // DigitalOcean GenAI API endpoint
  const API_ENDPOINT = 'https://api.digitalocean.com/v2/ai';
  
  // Your API token (to be provided as an environment variable)
  const API_TOKEN = process.env.DO_API_TOKEN;
  
  if (!API_TOKEN) {
    console.error('❌ Error: DigitalOcean API token not found. Please set the DO_API_TOKEN environment variable.');
    process.exit(1);
  }
  
  // Extract plain text content from markdown
  const extractTextFromMarkdown = (content) => {
    // Remove YAML front matter
    let text = content;
    if (content.startsWith('---')) {
      const endOfFrontMatter = content.indexOf('---', 3);
      if (endOfFrontMatter !== -1) {
        text = content.slice(endOfFrontMatter + 3);
      }
    }
    
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    
    // Remove HTML tags
    text = text.replace(/<[^>]*>/g, '');
    
    // Remove markdown links but keep the text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    
    // Remove images
    text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
    
    return text;
  };
  
  // Function to check grammar using DigitalOcean's GenAI API
  const checkGrammar = async (text) => {
    try {
      const response = await axios.post(API_ENDPOINT, {
        model: 'claude-3-sonnet-20240229',
        prompt: `Please review the following text for grammatical errors, typos, incorrect sentence structures, passive voice, and unnecessary jargon. For each issue, identify the specific problem, explain why it's an issue, and suggest a correction. Format your response as a JSON array with objects containing: "issue_type", "text_with_issue", "explanation", and "suggestion".
  
  Text to review:
  ${text}
  
  Only identify actual issues. If there are no grammatical problems, return an empty array.
  Please format your response as valid JSON without any additional text.`,
        max_tokens: 1024
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_TOKEN}`
        }
      });
      
      // Parse the AI response to get the JSON data
      const aiResponse = response.data.choices[0].message.content;
      try {
        // Extract JSON from the response (in case there's additional text)
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      } catch (e) {
        console.error('❌ Error parsing AI response:', e);
        console.log('AI response:', aiResponse);
        return [];
      }
    } catch (error) {
      console.error('❌ Error checking grammar:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return [];
    }
  };
  
  // Process a single markdown file
  const processFile = async (filePath) => {
    try {
      console.log(`\nChecking grammar in ${filePath}...`);
      
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File does not exist: ${filePath}`);
        return false;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      const textToCheck = extractTextFromMarkdown(content);
      
      // Skip empty files or files with very little text content
      if (textToCheck.trim().length < 50) {
        console.log(`⚠️ Skipping ${filePath}: Not enough text content to check`);
        return true;
      }
      
      console.log(`Sending content to grammar check API...`);
      
      const issues = await checkGrammar(textToCheck);
      
      if (issues.length === 0) {
        console.log(`✅ ${filePath}: No grammar issues found`);
        return true;
      } else {
        console.log(`⚠️ ${filePath}: Found ${issues.length} grammar issues:`);
        issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue.issue_type}: "${issue.text_with_issue}"`);
          console.log(`     Explanation: ${issue.explanation}`);
          console.log(`     Suggestion: ${issue.suggestion}`);
          console.log();
        });
        return false;
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      return false;
    }
  };
  
  // Main function to process all markdown files
  const checkAllFiles = async () => {
    // Get files to check - either from command line args or find all
    let markdownFiles = [];
    
    if (process.argv.length > 2) {
      // Use files passed as arguments
      markdownFiles = process.argv.slice(2);
      console.log(`Checking grammar in specific file(s): ${markdownFiles.join(', ')}`);
    } else {
      // Find all markdown files
      markdownFiles = getAllMarkdownFiles('.');
      console.log(`Found ${markdownFiles.length} markdown files to check for grammar`);
    }
    
    if (markdownFiles.length === 0) {
      console.log('No files to check.');
      return true;
    }
    
    let allValid = true;
    
    // Process each file
    for (const file of markdownFiles) {
      const fileValid = await processFile(file);
      if (!fileValid) {
        allValid = false;
      }
    }
    
    return allValid;
  };
  
  // Run the grammar checker
  checkAllFiles().then(allValid => {
    if (!allValid) {
      console.error('\n❌ Grammar check failed: Issues were found');
      process.exit(1);
    } else {
      console.log('\n✅ Grammar check passed: No issues were found');
      process.exit(0);
    }
  }).catch(error => {
    console.error('❌ Error running grammar check:', error.message);
    process.exit(1);
  });