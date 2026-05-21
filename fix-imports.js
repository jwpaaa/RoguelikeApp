/**
 * 修复 Cocos Creator 导入路径
 * 
 * 步骤：
 *   1. 从备份目录复制所有 .ts 文件到目标目录（恢复被 PowerShell 损坏的中文注释）
 *   2. 去掉所有 import/export 中的 .js 后缀（Cocos Creator 不识别 .js 后缀）
 * 
 * 用法：node fix-imports.js
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join('D:', 'wb.jiwenpeng01', 'Desktop', 'cs', 'code', 'RoguelikeClient', 'assets', 'scripts');
const TARGET_DIR = path.join(__dirname, 'RoguelikeClient', 'assets', 'scripts');

// ========== 步骤 1：复制备份文件 ==========
function copyDir(src, dest) {
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('步骤 1：从备份目录复制 .ts 文件...');
console.log('  备份:', BACKUP_DIR);
console.log('  目标:', TARGET_DIR);

if (!fs.existsSync(BACKUP_DIR)) {
    console.error('❌ 备份目录不存在！请确认路径：', BACKUP_DIR);
    process.exit(1);
}

copyDir(BACKUP_DIR, TARGET_DIR);
console.log('  ✅ 复制完成\n');

// ========== 步骤 2：去掉 import 中的 .js 后缀 ==========
function walkDir(dir, callback) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkDir(fullPath, callback);
        } else if (entry.isFile() && entry.name.endsWith('.ts')) {
            callback(fullPath);
        }
    }
}

console.log('步骤 2：去掉 import/export 中的 .js 后缀...');

let fixedCount = 0;

walkDir(TARGET_DIR, (filePath) => {
    const original = fs.readFileSync(filePath, 'utf-8');
    
    // 匹配 import/export 语句中的 .js 后缀
    // import { x } from './Foo.js'  →  import { x } from './Foo'
    // import x from "../Bar.js"     →  import x from "../Bar"
    const modified = original.replace(
        /(from\s+['"])([^'"]+)\.js(['"])/g,
        '$1$2$3'
    );
    
    if (original !== modified) {
        fs.writeFileSync(filePath, modified, 'utf-8');
        const relPath = path.relative(TARGET_DIR, filePath);
        console.log(`  ✅ ${relPath}`);
        fixedCount++;
    }
});

console.log(`\n共修复 ${fixedCount} 个文件。`);
console.log('全部完成！现在可以在 Cocos Creator 中编译测试了。');
