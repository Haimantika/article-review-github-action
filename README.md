# Markdown Grammar Checker GitHub Action

A GitHub Action that automatically checks markdown files for grammar issues, passive voice, header structure, and whitespace formatting in pull requests.

## Features

- **Grammar and Style Checking**: Uses DigitalOcean's AI platform (Claude 3.5 Sonnet model) to detect grammar issues, passive voice, and poor wording
- **Header Structure**: Ensures consistent and proper header hierarchy in your markdown files
- **Whitespace Formatting**: Identifies trailing spaces and excessive spacing issues
- **Pull Request Integration**: Runs automatically on PR creation or update when markdown files are changed

## How to Use This Action

### 1. Set Up Repository Secrets

First, add these secrets to your GitHub repository:

1. Go to your repository → Settings → Secrets and variables → Actions
2. Add these secrets:
   - `DO_API_TOKEN`: Your DigitalOcean API token with access to AI services
   - `DO_AGENT_BASE_URL`: URL for your DigitalOcean AI agent (e.g., `https://your-agent-id.ondigitalocean.app`)

### 2. Create the Workflow File

Create a file at `.github/workflows/markdown-validator.yml` and paste the entire contents from of the `markdown-validator.yml` file

Then, paste the entire contents of the `grammar-checker.js` file between the `cat > grammar-checker.js << 'EOF'` and `EOF` lines.

### 3. Test the Action

The action will now run automatically on:
- Any pull request that contains markdown file changes
- Manual triggering via the "Actions" tab in your repository

## How It Works

### Architecture

1. **Trigger**: The action runs whenever a PR with markdown files is created or updated
2. **File Detection**: Uses `tj-actions/changed-files` to identify which markdown files changed in the PR
3. **Grammar Check**: For each changed file:
   - Extracts text content from markdown (removing YAML front matter, code blocks, etc.)
   - Sends content to DigitalOcean's AI service for analysis
   - Parses the AI response to extract identified issues
   - Reports issues in the GitHub Actions log

### AI Integration

The action uses DigitalOcean's AI platform with Claude 3.5 Sonnet to perform sophisticated grammar and style checking:

1. The markdown text is processed to remove formatting and focus on content
2. The AI is prompted to identify:
   - Grammatical errors
   - Typos
   - Incorrect sentence structures
   - Passive voice constructions
   - Unnecessary jargon
   - Header structure issues
   - Whitespace formatting problems
  
The result will be something like this:
<img width="1328" alt="Screenshot 2025-03-02 at 12 18 45 AM" src="https://github.com/user-attachments/assets/8c4ceaef-24f2-499e-b2ca-dea752e89307" />
 

### Results

For each detected issue, the action reports:
- Issue type (grammar, passive voice, etc.)
- The problematic text
- An explanation of why it's an issue
- A suggested correction

## Requirements

- DigitalOcean AI API access
- Node.js 18+
- Access to GitHub Actions
