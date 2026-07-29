#!/usr/bin/env node
// simple-setup.js - Store Locator Setup (Simplified)
// Kør: node simple-setup.js

const readline = require('readline');
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Farver for terminal output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    red: '\x1b[31m'
};

console.log(`${colors.blue}${colors.bright}
╔════════════════════════════════════════╗
║     🚀 STORE LOCATOR SIMPLE SETUP      ║
╚════════════════════════════════════════╝
${colors.reset}`);

let config = {};

// Hjælpefunktion til at stille spørgsmål
async function askQuestion(question, defaultValue = '') {
    return new Promise((resolve) => {
        const prompt = defaultValue 
            ? `${question} [${defaultValue}]: `
            : `${question}: `;
        
        rl.question(prompt, (answer) => {
            resolve(answer.trim() || defaultValue);
        });
    });
}

function safeExec(command) {
    try {
        return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    } catch (_) {
        return null;
    }
}

function runCommand(command) {
    execSync(command, { stdio: 'inherit' });
}

function runCommandSafe(command) {
    try {
        execSync(command, { stdio: 'inherit' });
        return true;
    } catch (_) {
        return false;
    }
}

function fileExists(p) {
    try {
        fs.accessSync(p, fs.constants.F_OK);
        return true;
    } catch (_) {
        return false;
    }
}

function getGitContext() {
    const inside = safeExec('git rev-parse --is-inside-work-tree');
    if (inside !== 'true') return { isRepo: false, originUrl: null };
    const originUrl = safeExec('git remote get-url origin');
    return { isRepo: true, originUrl: originUrl || null };
}

async function ensureSafeGitContext() {
    const { isRepo, originUrl } = getGitContext();
    if (!isRepo || !originUrl) return;

    const expectedRepoPath = `${config.GITHUB_USERNAME}/${config.GITHUB_REPO}`;
    const looksCorrect = originUrl.includes(expectedRepoPath);

    if (looksCorrect) return;

    console.log(`\n${colors.red}${colors.bright}⚠️  GIT SIKKERHED ADVARSEL${colors.reset}`);
    console.log(`${colors.red}Du kører setup i en mappe der allerede er et Git repo.${colors.reset}`);
    console.log(`${colors.red}Hvis du fortsætter her, kan du komme til at pushe til et andet kunderepo.${colors.reset}\n`);

    console.log(`${colors.yellow}Fundet origin:${colors.reset} ${originUrl}`);
    console.log(`${colors.yellow}Forventet repo:${colors.reset} https://github.com/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}.git\n`);

    console.log(`${colors.bright}Anbefalet (sikrere):${colors.reset}`);
    console.log(`- Opret en ny mappe til ${config.CLIENT_NAME} og kør setup der.`);
    console.log(`- Eller tilføj en ekstra remote og push til den (uden at ændre origin).\n`);

    const answer = await askQuestion('Vil du fortsætte i denne mappe? Skriv "JA" for at fortsætte', 'NEJ');
    if (answer.toUpperCase() !== 'JA') {
        console.log(`\n${colors.yellow}Stopper for at undgå at skubbe til forkert repo.${colors.reset}`);
        process.exit(1);
    }
}

function ensureGitRepoInitialized() {
    const inside = safeExec('git rev-parse --is-inside-work-tree');
    if (inside === 'true') return;

    console.log(`\n${colors.blue}🔧 Initialiserer git repo...${colors.reset}`);
    runCommand('git init');
}

function ensureMainBranch() {
    // Avoid global git config; just rename/switch locally.
    const currentBranch = safeExec('git branch --show-current');
    if (currentBranch === 'main') return;

    console.log(`${colors.blue}🌿 Sætter branch til "main"...${colors.reset}`);
    runCommand('git branch -M main');
}

function ensureInitialCommit(commitMessage) {
    const hasCommit = safeExec('git rev-parse --verify HEAD');
    if (hasCommit) return;

    console.log(`${colors.blue}✅ Laver første commit...${colors.reset}`);
    runCommand('git add .');
    runCommand(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);
}

function hasGhCli() {
    const v = safeExec('gh --version');
    return Boolean(v);
}

function ensureGitHubRepoAndRemote() {
    if (!hasGhCli()) {
        console.log(`\n${colors.yellow}ℹ️  GitHub CLI (gh) er ikke installeret, så jeg kan ikke oprette repo automatisk.${colors.reset}`);
        console.log(`${colors.yellow}Installer gh, eller opret repo manuelt på GitHub.${colors.reset}`);
        return false;
    }

    const fullName = `${config.GITHUB_USERNAME}/${config.GITHUB_REPO}`;
    const exists = safeExec(`gh repo view ${fullName} --json name --jq .name`);

    if (!exists) {
        console.log(`\n${colors.blue}🐙 Opretter GitHub repo: ${fullName}${colors.reset}`);
        runCommand(`gh repo create ${fullName} --public --source=. --remote=origin`);
    } else {
        const originUrl = safeExec('git remote get-url origin');
        if (!originUrl) {
            console.log(`\n${colors.blue}🔗 Tilføjer origin remote...${colors.reset}`);
            runCommand(`git remote add origin https://github.com/${fullName}.git`);
        }
    }

    return true;
}

function pushToOrigin() {
    const originUrl = safeExec('git remote get-url origin');
    if (!originUrl) return;

    console.log(`\n${colors.blue}⬆️  Pusher til origin...${colors.reset}`);
    const ok = runCommandSafe('git push -u origin main');
    if (!ok) {
        console.log(`\n${colors.yellow}ℹ️  Push blev afvist.${colors.reset}`);
        console.log(`${colors.yellow}Typisk betyder det, at remote indeholder commits du ikke har lokalt.${colors.reset}`);
        console.log(`${colors.yellow}Løsning:${colors.reset}`);
        console.log(`${colors.blue}git pull --rebase origin main${colors.reset}`);
        console.log(`${colors.blue}git push -u origin main${colors.reset}`);
        throw new Error('Git push failed (remote ahead). Pull/rebase required.');
    }
}

function hasUpstream() {
    const upstream = safeExec('git rev-parse --abbrev-ref --symbolic-full-name @{u}');
    return Boolean(upstream);
}

function publishStoreDataIfRequested() {
    const storesMin = path.join(process.cwd(), 'stores.min.json');
    const storesJson = path.join(process.cwd(), 'stores.json');
    const storesCsv = path.join(process.cwd(), 'stores.csv');

    if (!fileExists(storesMin) && !fileExists(storesJson) && !fileExists(storesCsv)) {
        // Nothing to publish (likely update not run yet)
        return;
    }

    if (!hasUpstream()) {
        console.log(`\n${colors.yellow}ℹ️  Springer auto-push af store-data over, fordi branch ikke tracker en remote endnu.${colors.reset}`);
        console.log(`${colors.yellow}Kør først git push (så upstream sættes), og prøv igen.${colors.reset}`);
        return;
    }

    console.log(`\n${colors.blue}📦 Comitter og pusher store-data (så CDN virker)...${colors.reset}`);
    // Add only generated data files
    runCommand('git add stores*.json stores*.csv');

    // Commit only if there are changes staged
    const hasStaged = safeExec('git diff --staged --name-only');
    if (!hasStaged) {
        console.log(`${colors.green}✅ Ingen ændringer i stores-filerne at committe.${colors.reset}`);
        return;
    }

    runCommand(`git commit -m "Update stores"`);
    runCommand('git push');
}

// Indsaml kun det nødvendige
async function collectInfo() {
    console.log(`\n${colors.yellow}📋 KONFIGURATION${colors.reset}\n`);
    
    config.CLIENT_NAME = await askQuestion('Klient navn (f.eks. "Rabens Saloner")');
    
    config.GOOGLE_API_KEY = await askQuestion('Google API Key');
    while (!config.GOOGLE_API_KEY.startsWith('AIza')) {
        console.log(`${colors.red}API key skal starte med AIza...${colors.reset}`);
        config.GOOGLE_API_KEY = await askQuestion('Google API Key');
    }
    
    config.GOOGLE_SHEET_URL = await askQuestion('Google Sheets URL');
    
    // Ekstract Sheet ID fra URL
    const match = config.GOOGLE_SHEET_URL.match(/\/d\/([a-zA-Z0-9-_]+)/);
    config.GOOGLE_SHEET_ID = match ? match[1] : config.GOOGLE_SHEET_URL;
    console.log(`   ${colors.green}Sheet ID: ${config.GOOGLE_SHEET_ID}${colors.reset}`);
    
    config.GOOGLE_SHEET_NAME = await askQuestion('Ark/fane navn i Google Sheet', 'Sheet1');
    
    config.GITHUB_USERNAME = await askQuestion('GitHub brugernavn', 'NicoBang');
    
    // Auto-generer repo navn
    config.GITHUB_REPO = `${config.CLIENT_NAME.toLowerCase().replace(/\s+/g, '-')}-store-locator`;
    console.log(`   ${colors.green}Repo navn: ${config.GITHUB_REPO}${colors.reset}`);

    console.log(`\n${colors.yellow}🛍️ SHOPIFY SECTION${colors.reset}\n`);
    const createSection = await askQuestion('Vil du generere en Shopify section fil? (sections/store_locator.liquid)', 'JA');
    config.SHOPIFY_CREATE_SECTION = createSection.toUpperCase() === 'JA';
    if (config.SHOPIFY_CREATE_SECTION) {
        const enableFilter = await askQuestion('Ønsker du filtrering mellem fysisk/online?', 'JA');
        config.SHOPIFY_ENABLE_FILTER = enableFilter.toUpperCase() === 'JA';

        const showPhone = await askQuestion('Skal telefon vises i butikkortet?', 'JA');
        config.SHOPIFY_SHOW_PHONE = showPhone.toUpperCase() === 'JA';

        const showEmail = await askQuestion('Skal email vises i butikkortet?', 'NEJ');
        config.SHOPIFY_SHOW_EMAIL = showEmail.toUpperCase() === 'JA';

        const copyToTheme = await askQuestion('Vil du kopiere section direkte ind i et lokalt Shopify theme repo?', 'NEJ');
        config.SHOPIFY_COPY_TO_THEME = copyToTheme.toUpperCase() === 'JA';
        if (config.SHOPIFY_COPY_TO_THEME) {
            config.SHOPIFY_THEME_PATH = await askQuestion('Sti til theme repo (eller direkte til "sections/" mappen)');
        }
    }

    // Convenience: allow running `node simple-setup.js` inside the client repo later.
    const runningFromDifferentFolder = path.resolve(__dirname) !== path.resolve(process.cwd());
    const hasLocalSetupScript = fileExists(path.join(process.cwd(), 'simple-setup.js'));
    const hasLocalShopifyTemplate = fileExists(path.join(process.cwd(), 'shopify_section_template.md'));
    const canCopySelf = typeof __filename === 'string' && fileExists(__filename);

    if (runningFromDifferentFolder && canCopySelf && (!hasLocalSetupScript || !hasLocalShopifyTemplate)) {
        console.log(`\n${colors.yellow}🧰 SETUP-FILER (valgfrit)${colors.reset}\n`);
        const copySetupFiles = await askQuestion('Vil du kopiere simple-setup.js + shopify_section_template.md ind i dette projekt (så du kan køre `node simple-setup.js` herfra senere)?', 'JA');
        config.COPY_SETUP_FILES = copySetupFiles.toUpperCase() === 'JA';
    } else {
        config.COPY_SETUP_FILES = false;
    }
}

// Opret projekt struktur
function createProjectStructure() {
    console.log(`\n${colors.blue}📁 Opretter projekt struktur...${colors.reset}`);
    
    const dirs = ['src', '.github/workflows', 'scripts', 'sections'];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`   ✅ ${dir}/`);
        }
    });
}

function createShopifySection() {
    if (!config.SHOPIFY_CREATE_SECTION) return;

    console.log(`${colors.blue}🧩 Opretter Shopify section...${colors.reset}`);

    const localTemplatePath = path.join(process.cwd(), 'shopify_section_template.md');
    const templatePath = fileExists(localTemplatePath)
        ? localTemplatePath
        : path.join(__dirname, 'shopify_section_template.md');
    if (!fs.existsSync(templatePath)) {
        console.log(`${colors.yellow}⚠️  Kunne ikke finde shopify template: ${templatePath}${colors.reset}`);
        console.log(`${colors.yellow}Springer section generation over.${colors.reset}`);
        return;
    }

    const storesUrl = `https://cdn.jsdelivr.net/gh/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}@main/stores.min.json`;
    let content = fs.readFileSync(templatePath, 'utf8');

    // 1) Repo-specifik STORES_URL
    content = content.replace(/STORES_URL:\s*'[^']*'/, `STORES_URL: '${storesUrl}'`);

    // 2) Filter UI + logik (physical/online)
    const filterButtonsBlock = `
  <div class="filter-buttons">
    <button class="filter-btn active" onclick="filterStores('all', this)">Alle</button>
    <button class="filter-btn" onclick="filterStores('physical', this)">Fysiske butikker</button>
    <button class="filter-btn" onclick="filterStores('online', this)">Online butikker</button>
  </div>`;

    if (config.SHOPIFY_ENABLE_FILTER) {
        content = content.replace(
            /\{%\s*comment\s*%\}\s*<div class="filter-buttons">[\s\S]*?<\/div>\s*\{%\s*endcomment\s*%\}/m,
            filterButtonsBlock
        );

        // Enable filter CSS (strip /* ... */ around .filter-buttons block)
        content = content.replace(/\/\*\s*\.filter-buttons[\s\S]*?\.filter-btn\.active[\s\S]*?\*\/\s*/m, (m) => {
            return m.replace(/^\/\*\s*/m, '').replace(/\s*\*\/\s*$/m, '');
        });

        // Enable filtering in JS
        content = content.replace(/\/\/ if \(currentFilter==="physical"\)/g, 'if (currentFilter==="physical")');
        content = content.replace(/\/\/ if \(currentFilter==="online"\)/g, 'if (currentFilter==="online")');

        // Enable filterStores handler
        content = content.replace(
            `// window.filterStores = function(type, btn) {\n` +
            `  //   document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));\n` +
            `  //   btn.classList.add("active"); currentFilter=type; searchStores();\n` +
            `  // };`,
            `window.filterStores = function(type, btn) {\n` +
            `    document.querySelectorAll(".filter-btn").forEach(b=>b.classList.remove("active"));\n` +
            `    btn.classList.add("active"); currentFilter=type; searchStores();\n` +
            `  };`
        );

        // Enable store badges (remove HTML comment wrapper)
        content = content.replace(
            /<!--\s*[\r\n]+\s*<div class="store-badges">[\s\S]*?<\/div>\s*[\r\n]+\s*-->\s*/m,
            (m) => m.replace(/<!--\s*/m, '').replace(/\s*-->\s*$/m, '')
        );
    } else {
        // Remove the (commented) filter buttons entirely for cleaner output
        content = content.replace(
            /\{%\s*comment\s*%\}\s*<div class="filter-buttons">[\s\S]*?<\/div>\s*\{%\s*endcomment\s*%\}\s*/m,
            ''
        );
    }

    // 3) Phone / Email visibility in store cards
    if (!config.SHOPIFY_SHOW_PHONE) {
        content = content.replace(
            /\s*\$\{s\.Phone\?\`<div>\$\{s\.Phone\}<\/div>\`\:""\}\s*\n/m,
            ''
        );
    }

    if (config.SHOPIFY_SHOW_EMAIL) {
        const emailSnippet = '          ${s.Email?`<div><a href="mailto:${s.Email}">${s.Email}</a></div>`:""}\n';
        // Insert after city/postal line (stable anchor)
        const cityLineRegex = /\s*\$\{s\.City\|\|s\["Postal Code"\]\?\`<div>\$\{s\["Postal Code"\]\|\|""\} \$\{s\.City\|\|""\}<\/div>\`\:""\}\s*\n/m;
        content = content.replace(cityLineRegex, (m) => m + emailSnippet);
    }

    // Write section file into Shopify-compatible folder name
    const outputPath = path.join(process.cwd(), 'sections', 'store_locator.liquid');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);
    console.log(`   ✅ sections/store_locator.liquid`);

    if (config.SHOPIFY_COPY_TO_THEME && config.SHOPIFY_THEME_PATH) {
        const os = require('os');
        let providedPath = config.SHOPIFY_THEME_PATH.replace(/^~\//, `${os.homedir()}/`);
        providedPath = path.resolve(providedPath);

        const isSectionsDir = path.basename(providedPath) === 'sections';
        const themeRoot = isSectionsDir ? path.dirname(providedPath) : providedPath;
        const themeSectionsDir = isSectionsDir ? providedPath : path.join(themeRoot, 'sections');
        const themeTarget = path.join(themeSectionsDir, 'store_locator.liquid');

        if (!fs.existsSync(themeRoot)) {
            console.log(`${colors.yellow}⚠️  Theme path findes ikke: ${themeRoot}${colors.reset}`);
            console.log(`${colors.yellow}Springer copy til theme over.${colors.reset}`);
            return;
        }

        fs.mkdirSync(themeSectionsDir, { recursive: true });
        if (fs.existsSync(themeTarget)) {
            console.log(`${colors.yellow}⚠️  Fandt eksisterende: ${themeTarget}${colors.reset}`);
            console.log(`${colors.yellow}Jeg overskriver ikke automatisk. Slet filen først eller kopier manuelt hvis du vil erstatte den.${colors.reset}`);
            return;
        }

        fs.copyFileSync(outputPath, themeTarget);
        console.log(`   ✅ Kopieret til theme: ${themeTarget}`);
    }
}

function copySetupFilesIntoProject() {
    if (!config.COPY_SETUP_FILES) return;

    const targetSetupScript = path.join(process.cwd(), 'simple-setup.js');
    const targetTemplate = path.join(process.cwd(), 'shopify_section_template.md');
    const sourceTemplate = path.join(__dirname, 'shopify_section_template.md');

    console.log(`${colors.blue}🧰 Kopierer setup-filer ind i projektet...${colors.reset}`);

    // Don't overwrite: if they already exist, keep them.
    if (!fileExists(targetSetupScript)) {
        fs.copyFileSync(__filename, targetSetupScript);
        console.log(`   ✅ simple-setup.js`);
    } else {
        console.log(`   ℹ️  simple-setup.js findes allerede (overskriver ikke)`);
    }

    if (!fileExists(targetTemplate) && fileExists(sourceTemplate)) {
        fs.copyFileSync(sourceTemplate, targetTemplate);
        console.log(`   ✅ shopify_section_template.md`);
    } else if (fileExists(targetTemplate)) {
        console.log(`   ℹ️  shopify_section_template.md findes allerede (overskriver ikke)`);
    } else {
        console.log(`${colors.yellow}   ⚠️  Kunne ikke finde shopify_section_template.md til at kopiere${colors.reset}`);
    }
}

// Opret .env fil
function createEnvFile() {
    console.log(`${colors.blue}📝 Opretter .env fil...${colors.reset}`);
    
    const envContent = `# Store Locator Configuration
# Client: ${config.CLIENT_NAME}
# Generated: ${new Date().toISOString()}

# Google Sheets
GOOGLE_API_KEY=${config.GOOGLE_API_KEY}
GOOGLE_SHEET_ID=${config.GOOGLE_SHEET_ID}
GOOGLE_SHEET_NAME=${config.GOOGLE_SHEET_NAME}

# GitHub
GITHUB_USERNAME=${config.GITHUB_USERNAME}
GITHUB_REPO=${config.GITHUB_REPO}

# Client
CLIENT_NAME=${config.CLIENT_NAME}
`;
    
    fs.writeFileSync('.env', envContent);
    console.log(`   ✅ .env`);
}

// Opret updater script
function createUpdaterScript() {
    console.log(`${colors.blue}🔧 Opretter updater script...${colors.reset}`);
    
    const scriptContent = `// Store Updater for ${config.CLIENT_NAME}
// Simpel version - én fil til alle shops

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');

const CONFIG = {
    GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID,
    GOOGLE_SHEET_NAME: process.env.GOOGLE_SHEET_NAME || 'Sheet1',
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GITHUB_USERNAME: process.env.GITHUB_USERNAME,
    GITHUB_REPO: process.env.GITHUB_REPO
};

async function fetchFromGoogleSheets() {
    console.log('📊 Henter data fra Google Sheets...');
    
    const range = \`\${CONFIG.GOOGLE_SHEET_NAME}!A1:Z1000\`;
    const url = \`https://sheets.googleapis.com/v4/spreadsheets/\${CONFIG.GOOGLE_SHEET_ID}/values/\${encodeURIComponent(range)}?key=\${CONFIG.GOOGLE_API_KEY}\`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
        const error = await response.text();
        throw new Error(\`Google Sheets API fejl: \${response.status} - \${error}\`);
    }
    
    const data = await response.json();
    const rows = data.values;
    
    if (!rows || rows.length === 0) {
        throw new Error('Ingen data fundet i Google Sheets');
    }
    
    // Konverter til JSON
    const headers = rows[0];
    const stores = rows.slice(1).map(row => {
        const store = {};
        headers.forEach((header, index) => {
            store[header] = row[index] || '';
        });
        return store;
    });
    
    console.log(\`✅ Hentet \${stores.length} butikker\`);
    return stores;
}

function convertToCSV(stores) {
    if (!stores || stores.length === 0) return '';
    
    const headers = Object.keys(stores[0]);
    const csvRows = [headers.join(',')];
    
    stores.forEach(store => {
        const row = headers.map(header => {
            const value = store[header] || '';
            if (value.toString().includes(',') || value.toString().includes('"') || value.toString().includes('\\n')) {
                return \`"\${value.toString().replace(/"/g, '""')}"\`;
            }
            return value;
        });
        csvRows.push(row.join(','));
    });
    
    return csvRows.join('\\n');
}

async function main() {
    console.log('🚀 Starter Store Locator opdatering...');
    console.log(\`📅 \${new Date().toISOString()}\\n\`);
    
    try {
        const stores = await fetchFromGoogleSheets();
        
        // Gem JSON (formateret og minified)
        fs.writeFileSync('stores.json', JSON.stringify(stores, null, 2));
        fs.writeFileSync('stores.min.json', JSON.stringify(stores));
        
        // Gem CSV
        const csv = convertToCSV(stores);
        fs.writeFileSync('stores.csv', csv);
        
        console.log('\\n✅ Filer oprettet:');
        console.log('   • stores.json (formateret)');
        console.log('   • stores.min.json (minified)');
        console.log('   • stores.csv');
        
        console.log('\\n📦 CDN URL (efter GitHub push):');
        console.log(\`   https://cdn.jsdelivr.net/gh/\${CONFIG.GITHUB_USERNAME}/\${CONFIG.GITHUB_REPO}@main/stores.min.json\`);
        
    } catch (error) {
        console.error('\\n❌ Fejl:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { main };
`;
    
    fs.writeFileSync('src/store-updater.js', scriptContent);
    console.log(`   ✅ src/store-updater.js`);
}

// Opret package.json
function createPackageJson() {
    console.log(`${colors.blue}📦 Opretter package.json...${colors.reset}`);
    
    const packageJson = {
        name: config.GITHUB_REPO,
        version: "1.0.0",
        description: `Store Locator for ${config.CLIENT_NAME}`,
        main: "src/store-updater.js",
        scripts: {
            "update": "node src/store-updater.js",
            "test": "node scripts/test-connection.js",
            "deploy": "npm run update && git add . && git commit -m 'Update stores' && git push"
        },
        dependencies: {
            "node-fetch": "^2.6.7",
            "dotenv": "^16.0.3"
        },
        keywords: ["store-locator", "shopify", config.CLIENT_NAME.toLowerCase()],
        author: "",
        license: "MIT"
    };
    
    fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
    console.log(`   ✅ package.json`);
}

// Opret GitHub Action
function createGitHubAction() {
    console.log(`${colors.blue}🤖 Opretter GitHub Action...${colors.reset}`);
    
    const actionContent = `name: Update Store Data

on:
  schedule:
    - cron: '0 6 * * *'  # Dagligt kl 06:00 UTC
  workflow_dispatch:      # Manuel trigger

jobs:
  update:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Update store data
      env:
        GOOGLE_API_KEY: \${{ secrets.GOOGLE_API_KEY }}
        GOOGLE_SHEET_ID: \${{ secrets.GOOGLE_SHEET_ID }}
        GOOGLE_SHEET_NAME: \${{ secrets.GOOGLE_SHEET_NAME }}
      run: npm run update
    
    - name: Commit and push if changed
      run: |
        git config --local user.email "action@github.com"
        git config --local user.name "GitHub Action"
        git add stores*.json stores*.csv
        git diff --quiet && git diff --staged --quiet || (git commit -m "Auto-update: \$(date +'%Y-%m-%d %H:%M')" && git push)
`;
    
    fs.writeFileSync('.github/workflows/update.yml', actionContent);
    console.log(`   ✅ .github/workflows/update.yml`);
}

// Opret test script
function createTestScript() {
    console.log(`${colors.blue}🧪 Opretter test script...${colors.reset}`);
    
    const testScript = `// Test Connection Script
require('dotenv').config();
const fetch = require('node-fetch');

async function test() {
    console.log('🧪 Testing Google Sheets connection...\\n');
    
    const url = \`https://sheets.googleapis.com/v4/spreadsheets/\${process.env.GOOGLE_SHEET_ID}/values/\${process.env.GOOGLE_SHEET_NAME}!A1:A1?key=\${process.env.GOOGLE_API_KEY}\`;
    
    try {
        const response = await fetch(url);
        if (response.ok) {
            console.log('✅ Google Sheets connection OK');
            const data = await response.json();
            console.log(\`   Sheet: "\${process.env.GOOGLE_SHEET_NAME}"\\n\`);
        } else {
            console.log('❌ Google Sheets error:', response.status);
            const error = await response.text();
            console.log('   ', error.substring(0, 200));
        }
    } catch (e) {
        console.log('❌ Connection error:', e.message);
    }
    
    console.log('📋 Configuration:');
    console.log('   Client:', process.env.CLIENT_NAME);
    console.log('   GitHub:', \`\${process.env.GITHUB_USERNAME}/\${process.env.GITHUB_REPO}\`);
    console.log('   Sheet ID:', process.env.GOOGLE_SHEET_ID);
}

test();
`;
    
    fs.writeFileSync('scripts/test-connection.js', testScript);
    console.log(`   ✅ scripts/test-connection.js`);
}

// Opret README
function createReadme() {
    console.log(`${colors.blue}📚 Opretter README...${colors.reset}`);
    
    const readmeContent = `# ${config.CLIENT_NAME} Store Locator

Simpel store locator der henter data fra Google Sheets og gør det tilgængeligt via CDN.

## 🚀 Quick Start

\`\`\`bash
# Install dependencies
npm install

# Test connection
npm test

# Update store data
npm run update

# Deploy til GitHub
npm run deploy
\`\`\`

## 📦 CDN URL

Efter data er pushed til GitHub, er det tilgængeligt på:

\`\`\`
https://cdn.jsdelivr.net/gh/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}@main/stores.min.json
\`\`\`

## 📊 Data Source

- **Google Sheet:** [View/Edit](https://docs.google.com/spreadsheets/d/${config.GOOGLE_SHEET_ID})
- **Sheet Name:** ${config.GOOGLE_SHEET_NAME}

## 🔄 Automatisk Opdatering

Data opdateres automatisk hver dag kl. 07:00 CET via GitHub Actions.

### Manuel opdatering

1. Rediger data i Google Sheet
2. Kør: \`npm run update\`
3. Push til GitHub: \`git push\`

## 📁 Output Filer

- \`stores.json\` - Formateret JSON (læsbar)
- \`stores.min.json\` - Minified JSON (til produktion)
- \`stores.csv\` - CSV format

## 📝 Google Sheet Kolonner

Påkrævede kolonner:
- Company
- Address
- Postal Code
- City
- Country
- Phone
- Website

Valgfrie kolonner:
- Email
- Physical (marker med "X")
- Online (marker med "X")
- Enhver anden kolonne du ønsker

## 🔒 Sikkerhed

- API keys gemmes i \`.env\` (committes aldrig)
- GitHub Secrets bruges til automation
- Google Sheet skal være delt som "Alle med link kan se"

## 🛠️ Shopify Integration

I din Shopify butik kan du bruge data sådan:

\`\`\`javascript
fetch('https://cdn.jsdelivr.net/gh/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}@main/stores.min.json')
  .then(response => response.json())
  .then(stores => {
    // Brug stores data til at vise butikker
    console.log(stores);
  });
\`\`\`

---
Generated: ${new Date().toISOString()}
`;
    
    fs.writeFileSync('README.md', readmeContent);
    console.log(`   ✅ README.md`);
}

// Opret .gitignore
function createGitIgnore() {
    console.log(`${colors.blue}🔒 Opretter .gitignore...${colors.reset}`);
    
    const gitignoreContent = `.env
.env.local
node_modules/
.DS_Store
*.log
*.tmp
.vscode/
.idea/
`;
    
    fs.writeFileSync('.gitignore', gitignoreContent);
    console.log(`   ✅ .gitignore`);
}

// Vis næste skridt
function showNextSteps() {
    const gitCtx = getGitContext();
    const expectedRemoteUrl = `https://github.com/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}.git`;
    const safeRemoteName = 'target';

    console.log(`\n${colors.green}${colors.bright}
╔════════════════════════════════════════╗
║         ✅ SETUP COMPLETE!             ║
╚════════════════════════════════════════╝
${colors.reset}

${colors.yellow}📋 NÆSTE SKRIDT:${colors.reset}

${colors.bright}1️⃣  Install dependencies:${colors.reset}
    ${colors.blue}npm install${colors.reset}

${colors.bright}2️⃣  Test forbindelse:${colors.reset}
    ${colors.blue}npm test${colors.reset}

${colors.bright}3️⃣  Kør første update:${colors.reset}
    ${colors.blue}npm run update${colors.reset}

${colors.bright}4️⃣  GitHub repo (vigtigt: undgå at pushe til forkert kunde):${colors.reset}
    ${colors.blue}git remote -v${colors.reset}

${gitCtx.isRepo ? (
gitCtx.originUrl && gitCtx.originUrl.includes(`${config.GITHUB_USERNAME}/${config.GITHUB_REPO}`)
? `${colors.green}    ✅ origin ser korrekt ud (${gitCtx.originUrl})${colors.reset}
    ${colors.blue}git push${colors.reset}`
:
`${colors.red}    ⚠️  origin peger på et andet repo:${colors.reset} ${gitCtx.originUrl || '(ingen origin)'}

    ${colors.bright}Sikrere løsning (behold eksisterende origin, push kun til nyt repo):${colors.reset}
    ${colors.blue}git remote add ${safeRemoteName} ${expectedRemoteUrl}
    git push ${safeRemoteName} main${colors.reset}

    ${colors.bright}Hvis denne mappe SKAL blive ${config.GITHUB_REPO}:${colors.reset}
    ${colors.blue}git remote set-url origin ${expectedRemoteUrl}${colors.reset}`
) : `${colors.bright}    Hvis dette er en ny mappe uden git:${colors.reset}
    ${colors.blue}git init
    git add .
    git commit -m "Initial setup for ${config.CLIENT_NAME}"
    gh repo create ${config.GITHUB_REPO} --public --source=. --push${colors.reset}

    Eller manuelt på: github.com/new`}

${colors.bright}5️⃣  Setup GitHub Secrets:${colors.reset}
    Gå til: ${colors.blue}github.com/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}/settings/secrets${colors.reset}
    
    Tilføj disse secrets:
    • GOOGLE_API_KEY = ${config.GOOGLE_API_KEY.substring(0, 10)}...
    • GOOGLE_SHEET_ID = ${config.GOOGLE_SHEET_ID}
    • GOOGLE_SHEET_NAME = ${config.GOOGLE_SHEET_NAME}

${colors.bright}📊 CDN URL (når data er på GitHub):${colors.reset}
    ${colors.blue}https://cdn.jsdelivr.net/gh/${config.GITHUB_USERNAME}/${config.GITHUB_REPO}@main/stores.min.json${colors.reset}

${colors.green}God fornøjelse! 🎉${colors.reset}
`);
}

// Main execution
async function main() {
    try {
        await collectInfo();
        await ensureSafeGitContext();
        
        console.log(`\n${colors.bright}🔧 Opretter projekt filer...${colors.reset}\n`);
        
        createProjectStructure();
        createEnvFile();
        createPackageJson();
        createUpdaterScript();
        createGitHubAction();
        createTestScript();
        createReadme();
        createGitIgnore();
        createShopifySection();
        copySetupFilesIntoProject();

        const setupGit = await askQuestion('Vil du sætte git + GitHub repo op automatisk nu? (anbefalet)', 'JA');
        if (setupGit.toUpperCase() === 'JA') {
            ensureGitRepoInitialized();
            ensureMainBranch();
            ensureInitialCommit(`Initial setup for ${config.CLIENT_NAME}`);

            const ok = ensureGitHubRepoAndRemote();
            if (ok) {
                // One more safety check: if origin is wrong, do NOT push.
                await ensureSafeGitContext();
                pushToOrigin();

                const runUpdateNow = await askQuestion('Vil du køre npm install + npm run update og pushe stores-filerne nu? (så CDN virker med det samme)', 'JA');
                if (runUpdateNow.toUpperCase() === 'JA') {
                    runCommand('npm install');
                    runCommand('npm run update');
                    publishStoreDataIfRequested();
                }
            }
        }
        
        showNextSteps();
        
    } catch (error) {
        console.error(`${colors.red}❌ Fejl: ${error.message}${colors.reset}`);
    } finally {
        rl.close();
    }
}

// Start programmet
main();