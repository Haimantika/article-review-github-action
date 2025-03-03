const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('@actions/glob');
const fs = require('fs');
const axios = require('axios');

async function run() {
  try {
    // Get inputs
    const filePattern = core.getInput('file-pattern');
    const excludePattern = core.getInput('exclude-pattern');
    const doApiToken = core.getInput('do-api-token');
    const doAgentBaseUrl = core.getInput('do-agent-base-url');
    
    if (!doApiToken) {
      core.setFailed('DigitalOcean API token not provided');
      return;
    }
    
    if (!doAgentBaseUrl) {
      core.setFailed('DigitalOcean AI agent base URL not provided');
      return;
    }
    
    // Set up API endpoint
    const agentEndpoint = `${doAgentBaseUrl}/api/v1/chat/completions`;
    
    // Find files to check
    const globber = await glob.create(filePattern, {
      ignore: excludePattern.split(',')
    });
    const files = await globber.glob();
    
    core.info(`Found ${files.length} markdown files to check`);
    
    if (files.length === 0) {
      core.info('No markdown files to check');
      return;
    }
    
    // Check each file
    let allPassed = true;
    for (const file of files) {
      const result = await processFile(file, agentEndpoint, doApiToken);
      if (!result) {
        allPassed = false;
      }
    }
    
    if (!allPassed) {
      core.setFailed('Grammar check failed: Issues were found');
    } else {
      core.info('Grammar check passed: No issues were found');
    }
    
  } catch (error) {
    core.setFailed(`Action failed: ${error.message}`);
  }
}

// Extract plain text content from markdown
function extractTextFromMarkdown(content) {
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
}

// Function to check grammar using DigitalOcean's AI Agent
async function checkGrammar(text, agentEndpoint, apiToken) {
  try {
    core.info("Starting grammar analysis...");
    
    const payloadData = {
      model: "claude-3.5-sonnet",
      messages: [
        {
          role: "system",
          content: "You are a skilled editor focused on identifying grammatical errors, typos, incorrect sentence structures, passive voice, and unnecessary jargon."
        },
        {
          role: "user",
          content: `Please review the following text for grammatical errors, typos, incorrect sentence structures, passive voice, and unnecessary jargon. For each issue, identify the specific problem, explain why it's an issue, and suggest a correction. Format your response as a JSON array with objects containing: "issue_type", "text_with_issue", "explanation", and "suggestion". Only identify actual issues. If there are no grammatical problems, return an empty array.\n\nText to review:\n${text}. Please also identify if the H tags are in correct order, if there are any trailing and extra spaces.`
        }
      ],
      temperature: 0.0,
      max_tokens: 1024
    };
    
    const response = await axios.post(agentEndpoint, payloadData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      }
    });
    
    core.info("Analysis complete");
    
    // Parse the AI response to get the JSON data
    const aiResponse = response.data.choices[0].message.content;
    
    try {
      // Extract JSON from the response
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch (e) {
      core.error('Error parsing AI response');
      return [];
    }
  } catch (error) {
    core.error(`Error checking grammar: ${error.message}`);
    if (error.response) {
      core.error(`Response status: ${error.response.status}`);
      core.error('Error: Grammar service returned an error');
    }
    return [];
  }
}

// Process a single markdown file
async function processFile(filePath, agentEndpoint, apiToken) {
  try {
    core.info(`\nChecking grammar in ${filePath}...`);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      core.error(`Error: File does not exist: ${filePath}`);
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const textToCheck = extractTextFromMarkdown(content);
    
    // Skip empty files or files with very little text content
    if (textToCheck.trim().length < 50) {
      core.warning(`Skipping ${filePath}: Not enough text content to check`);
      return true;
    }
    
    core.info(`Analyzing content...`);
    
    const issues = await checkGrammar(textToCheck, agentEndpoint, apiToken);
    
    if (issues.length === 0) {
      core.info(`✅ ${filePath}: No grammar issues found`);
      return true;
    } else {
      core.warning(`⚠️ ${filePath}: Found ${issues.length} grammar issues:`);
      issues.forEach((issue, index) => {
        core.warning(`  ${index + 1}. ${issue.issue_type}: "${issue.text_with_issue}"`);
        core.warning(`     Explanation: ${issue.explanation}`);
        core.warning(`     Suggestion: ${issue.suggestion}`);
      });
      return false;
    }
  } catch (error) {
    core.error(`Error processing ${filePath}: ${error.message}`);
    return false;
  }
}

run();