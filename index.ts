#!/usr/bin/env bun

import fs from "fs";
import path from "path";
import { Command } from "commander";
import inquirer from "inquirer";
import chalk from "chalk";

// Gợi ý ngôn ngữ cho Markdown code block
function getLanguageHint(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const map: Record<string, string> = {
        '.js': 'javascript', '.ts': 'typescript', '.jsx': 'jsx', '.tsx': 'tsx',
        '.py': 'python', '.java': 'java', '.cs': 'csharp', '.php': 'php',
        '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.swift': 'swift',
        '.kt': 'kotlin', '.scala': 'scala', '.html': 'html', '.css': 'css',
        '.scss': 'scss', '.sh': 'bash', '.ps1': 'powershell', '.sql': 'sql',
        '.xml': 'xml', '.txt': ''
    };
    return map[ext] || '';
}

// Xử lý file
function processFile(filePath: string, basePath: string): string {
    const relativePath = path.relative(basePath, filePath);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const languageHint = getLanguageHint(filePath);
        return `---
File: ${relativePath.replace(/\\/g, '/')}
---
\`\`\`${languageHint}
${content.trim()}
\`\`\`\n\n`;
    } catch (err: any) {
        return `---
File: ${relativePath.replace(/\\/g, '/')}
---
Error reading file: ${err.message}\n\n`;
    }
}

// Đệ quy duyệt thư mục
function scanDirectory(dirPath: string, basePath: string, allowedExtensions: string[]): string {
    let output = '';
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name.startsWith('.')) continue;
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            output += scanDirectory(fullPath, basePath, allowedExtensions);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (allowedExtensions.length === 0 || allowedExtensions.includes(ext)) {
                output += processFile(fullPath, basePath);
            }
        }
    }

    return output;
}

// CLI chọn nhiều file/thư mục
async function selectFilesOrDirs(): Promise<string[]> {
    const cwd = process.cwd();
    const entries = fs.readdirSync(cwd);
    const choices = entries
        .filter(name => !name.startsWith('.'))
        .map(name => {
            const fullPath = path.join(cwd, name);
            const isDir = fs.statSync(fullPath).isDirectory();
            return {
                name: name + (isDir ? '/' : ''),
                value: fullPath
            };
        });

    const { selected } = await inquirer.prompt<{ selected: string[] }>({
        type: 'checkbox',
        name: 'selected',
        message: 'Chọn file/thư mục muốn xử lý:',
        choices,
        validate: choices => choices.length > 0 ? true : 'Phải chọn ít nhất một mục.'
    });

    return selected;
}

// Khởi tạo CLI
const program = new Command();

program
    .name('dir2prompt')
    .description('Tạo prompt Markdown từ nhiều thư mục và file.')
    .option('-o, --output <file>', 'Tên file markdown đầu ra', 'output.md')
    .option('-e, --ext <extensions>', 'Chỉ lấy file có phần mở rộng, ví dụ: .js,.ts,.json', '')
    .action(async (options: { output: string, ext: string }) => {
        const selectedPaths = await selectFilesOrDirs();
        const exts = options.ext
            ? options.ext.split(',').map(e => e.trim().toLowerCase())
            : [];

        let finalOutput = `# Project Analysis Prompt\n\nAnalyze the following project structure and file contents.\n\n`;

        for (const item of selectedPaths) {
            const stat = fs.statSync(item);
            const basePath = path.dirname(item);
            finalOutput += `## From: ${path.basename(item)}\n\n`;

            if (stat.isDirectory()) {
                finalOutput += scanDirectory(item, item, exts);
            } else if (stat.isFile()) {
                finalOutput += processFile(item, basePath);
            }
        }

        fs.writeFileSync(options.output, finalOutput);
        console.log(chalk.green(`✅ Prompt đã được tạo ở: ${options.output}`));
    });

program.parse(process.argv);
