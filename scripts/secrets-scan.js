import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '../..');

const SECRET_PATTERNS = [
  {
    name: 'Generic API Key',
    severity: 'High',
    pattern: /\b(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]?([A-Za-z0-9_\-]{20,})['"]?/gi,
    groupIndex: 1
  },
  {
    name: 'Generic Secret / Password',
    severity: 'High',
    pattern: /\b(?:secret|password|passwd|pwd)\s*[:=]\s*['"]([^'"]{8,})['"]/gi,
    groupIndex: 1
  },
  {
    name: 'JWT Token',
    severity: 'Critical',
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
    groupIndex: 0
  },
  {
    name: 'MongoDB Connection URI',
    severity: 'Critical',
    pattern: /mongodb(?:\+srv)?:\/\/(?:[^\s:@'"]+):([^\s:@'"]+)@[^\s'"]+/gi,
    groupIndex: 0
  },
  {
    name: 'AWS Access Key ID',
    severity: 'Critical',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    groupIndex: 0
  },
  {
    name: 'AWS Secret Access Key',
    severity: 'Critical',
    pattern: /\b(?:aws[_-]?secret[_-]?access[_-]?key|aws_secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gi,
    groupIndex: 1
  },
  {
    name: 'SMTP Password',
    severity: 'High',
    pattern: /\b(?:smtp[_-]?password|mail[_-]?password|email[_-]?password)\s*[:=]\s*['"]([^'"]{6,})['"]/gi,
    groupIndex: 1
  },
  {
    name: 'GitHub Token',
    severity: 'Critical',
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{36,251}\b/g,
    groupIndex: 0
  },
  {
    name: 'Stripe Secret Key',
    severity: 'Critical',
    pattern: /\bsk_live_[0-9a-zA-Z]{24,}\b/g,
    groupIndex: 0
  },
  {
    name: 'Stripe Publishable Key',
    severity: 'High',
    pattern: /\bpk_live_[0-9a-zA-Z]{24,}\b/g,
    groupIndex: 0
  },
  {
    name: 'Private Key (RSA/EC)',
    severity: 'Critical',
    pattern: /-----BEGIN (?:RSA |EC |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |PGP )?PRIVATE KEY-----/g,
    groupIndex: 0
  },
  {
    name: 'Google API Key',
    severity: 'High',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    groupIndex: 0
  },
  {
    name: 'Slack Token / Webhook',
    severity: 'High',
    pattern: /\b(?:xox[baprs]-[A-Za-z0-9-]{10,}|https:\/\/hooks\.slack\.com\/services\/T[A-Za-z0-9_]{8}\/B[A-Za-z0-9_]{8}\/[A-Za-z0-9_]{24})\b/g,
    groupIndex: 0
  },
  {
    name: 'Bearer Token Hardcoded',
    severity: 'High',
    pattern: /Bearer\s+([A-Za-z0-9_\-\.]{20,})/gi,
    groupIndex: 1
  },
  {
    name: 'Twilio API Key',
    severity: 'Critical',
    pattern: /\bSK[0-9a-fA-F]{32}\b/g,
    groupIndex: 0
  },
  {
    name: 'SendGrid API Key',
    severity: 'Critical',
    pattern: /\bSG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}\b/g,
    groupIndex: 0
  },
  {
    name: 'Generic Token',
    severity: 'Medium',
    pattern: /\b(?:access[_-]?token|refresh[_-]?token|auth[_-]?token|session[_-]?token|token)\s*[:=]\s*['"]([^'"]{16,})['"]/gi,
    groupIndex: 1
  },
  {
    name: 'Credential URL (user:pass)',
    severity: 'High',
    pattern: /[a-zA-Z][a-zA-Z0-9+.\-]*:\/\/([a-zA-Z0-9_\-]+):([a-zA-Z0-9_\-!@#$%^&*()+=])+@/g,
    groupIndex: 0
  },
  {
    name: 'Database URL with Credentials',
    severity: 'Critical',
    pattern: /(?:mysql|postgres|postgresql|redis|sqlite|oracle|sqlserver):\/\/[^\s:@'"]+:[^\s:@'"]+@[^\s'"]+/gi,
    groupIndex: 0
  }
];

const IGNORED_PATHS = [
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  'coverage',
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'npm-audit-report.json',
  '.env',
  '.env.local',
  '.env.*.local',
  '*.svg',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.pdf',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.eot',
  '*.map',
  'secrets-scan-report.json',
  'security-audit-report.json'
];

const IGNORED_FILENAME_PATTERNS = [
  /\.min\.(js|css)$/i,
  /\.bundle\.(js|css)$/i,
  /^tsconfig.*\.json$/i,
  /^jest\.config/i
];

function shouldSkipFile(filePath) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  for (const ignore of IGNORED_PATHS) {
    if (ignore.includes('*')) {
      const regex = new RegExp(ignore.replace(/\./g, '\\.').replace(/\*/g, '.*'), 'i');
      if (regex.test(relativePath)) return true;
    } else {
      if (relativePath.includes(ignore)) return true;
    }
  }
  for (const pattern of IGNORED_FILENAME_PATTERNS) {
    if (pattern.test(path.basename(filePath))) return true;
  }
  return false;
}

function getAllFiles(dir, fileList = []) {
  let files;
  try {
    files = fs.readdirSync(dir);
  } catch (e) {
    return fileList;
  }
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        if (!shouldSkipFile(filePath)) {
          fileList = getAllFiles(filePath, fileList);
        }
      } else {
        if (!shouldSkipFile(filePath) && stat.size < 10 * 1024 * 1024) {
          fileList.push(filePath);
        }
      }
    } catch (e) {}
  });
  return fileList;
}

function getContextSnippet(line, matchIndex, length = 10) {
  const trimmedLine = line.trim();
  if (trimmedLine.length <= length) return trimmedLine;
  const start = Math.max(0, matchIndex - 2);
  const end = Math.min(trimmedLine.length, start + length);
  return trimmedLine.substring(start, end);
}

function maskSecret(secret) {
  if (secret.length <= 8) return '*'.repeat(secret.length);
  return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
}

const findings = [];
const filesScanned = [];

console.log('🔍 Starting secrets scan of codebase...');
console.log(`📂 Root directory: ${ROOT_DIR}\n`);

const allFiles = getAllFiles(ROOT_DIR);
console.log(`📁 Total files found: ${allFiles.length}\n`);

let filesWithFindings = 0;

for (const filePath of allFiles) {
  const relativePath = path.relative(ROOT_DIR, filePath);
  filesScanned.push(relativePath);

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    continue;
  }

  const lines = content.split('\n');
  const fileFindings = [];

  for (const patternDef of SECRET_PATTERNS) {
    const regex = new RegExp(patternDef.pattern.source, patternDef.pattern.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const matchValue = patternDef.groupIndex === 0 ? match[0] : (match[patternDef.groupIndex] || match[0]);

      if (!matchValue || matchValue.length < 4) continue;
      if (matchValue.toLowerCase().includes('example') ||
          matchValue.toLowerCase().includes('placeholder') ||
          matchValue.toLowerCase().includes('your_') ||
          matchValue.toLowerCase().includes('your-') ||
          matchValue.toLowerCase().includes('xxxxx') ||
          matchValue.includes('process.env')) continue;

      let lineNum = 1;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length + 1 >= match.index) {
          lineNum = i + 1;
          break;
        }
        charCount += lines[i].length + 1;
      }

      const lineContent = lines[lineNum - 1] || '';
      const charInLine = match.index - charCount;
      const context = getContextSnippet(lineContent, charInLine);
      const maskedValue = maskSecret(matchValue);

      fileFindings.push({
        secretType: patternDef.name,
        severity: patternDef.severity,
        lineNumber: lineNum,
        column: charInLine + 1,
        contextSnippet: context.length > 10 ? context.substring(0, 10) : context,
        fullContext: lineContent.substring(
          Math.max(0, charInLine - 20),
          Math.min(lineContent.length, charInLine + 40)
        ).trim(),
        maskedValue: maskedValue,
        valueLength: matchValue.length
      });

      regex.lastIndex = match.index + 1;
    }
  }

  if (fileFindings.length > 0) {
    filesWithFindings++;
    findings.push({
      filePath: relativePath,
      absolutePath: filePath,
      fileSizeBytes: fs.statSync(filePath).size,
      findings: fileFindings
    });
  }
}

const totalFindings = findings.reduce((sum, f) => sum + f.findings.length, 0);
const severityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
findings.forEach(f => f.findings.forEach(finding => {
  severityCounts[finding.severity] = (severityCounts[finding.severity] || 0) + 1;
}));

const report = {
  scanMetadata: {
    scanTimestamp: new Date().toISOString(),
    rootDirectory: ROOT_DIR,
    totalFilesScanned: filesScanned.length,
    filesWithFindings: filesWithFindings,
    totalFindings: totalFindings,
    severityBreakdown: severityCounts
  },
  scanningParameters: {
    secretPatternsChecked: SECRET_PATTERNS.length,
    patterns: SECRET_PATTERNS.map(p => ({ name: p.name, severity: p.severity })),
    ignoredPaths: IGNORED_PATHS
  },
  findings: findings,
  filesScanned: filesScanned
};

const reportPath = path.join(__dirname, 'secrets-scan-report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('                    SECRETS SCAN RESULTS');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log(`  Files scanned:       ${filesScanned.length}`);
console.log(`  Files with findings: ${filesWithFindings}`);
console.log(`  Total findings:      ${totalFindings}\n`);
console.log('  Severity breakdown:');
console.log(`    🔴 Critical: ${severityCounts.Critical || 0}`);
console.log(`    🟠 High:     ${severityCounts.High || 0}`);
console.log(`    🟡 Medium:   ${severityCounts.Medium || 0}`);
console.log(`    🟢 Low:      ${severityCounts.Low || 0}\n`);

if (findings.length > 0) {
  console.log('  Detailed findings:');
  findings.forEach((file) => {
    console.log(`\n  📄 ${file.filePath}:`);
    file.findings.forEach((finding, i) => {
      const severityIcon = finding.severity === 'Critical' ? '🔴'
        : finding.severity === 'High' ? '🟠'
        : finding.severity === 'Medium' ? '🟡' : '🟢';
      console.log(`    ${i + 1}. ${severityIcon} [${finding.severity}] ${finding.secretType}`);
      console.log(`       Line: ${finding.lineNumber}, Col: ${finding.column}`);
      console.log(`       Context: "...${finding.fullContext}..."`);
      console.log(`       Value: ${finding.maskedValue} (len: ${finding.valueLength})`);
    });
  });
} else {
  console.log('  ✅ No hardcoded secrets detected!\n');
}

console.log(`\n📝 Full report saved to: ${reportPath}\n`);

process.exit(findings.length > 0 ? 1 : 0);
