const { spawn } = require('child_process');
const fs = require('fs');
require('dotenv').config();

const filePath = './docs/index.html';
const prompt = 'Review this repository and create a complete HTML webpage for GitHub Pages. Include HTML structure with CSS styling, project overview, features, installation, usage, and API documentation. Make it visually appealing with modern web design.';

console.log('Auto-generating GitHub Pages documentation...');

const runGemini = (prompt) => new Promise((resolve, reject) => {
  const model = process.env.model || 'gemini-2.5-flash';
  const timeout = setTimeout(() => {
    cli.kill();
    reject(new Error('Timeout: CLI took too long to respond'));
  }, 30000);
  
  const cli = spawn('gemini', ['--model', model, '-p', prompt], {
    env: { ...process.env }
  });
  let output = '';
  cli.stdout.on('data', (data) => output += data);
  cli.stderr.on('data', (data) => process.stderr.write(data));
  cli.on('close', () => {
    clearTimeout(timeout);
    resolve(output.trim());
  });
  cli.on('error', (err) => {
    clearTimeout(timeout);
    reject(err);
  });
});

(async () => {
  try {
    if (!fs.existsSync('./docs')) fs.mkdirSync('./docs');
    const output = await runGemini(prompt);
    if (output) {
      fs.writeFileSync(filePath, output);
      console.log(`Documentation generated: ${filePath}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('Make sure Gemini CLI is installed and available in PATH');
  }
})();