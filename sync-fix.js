const fs = require('fs');
const path = require('path');

const targets = [
    'D:\\wb.jiwenpeng01\\Desktop\\cs\\code\\RoguelikeClient',
    'D:\\wb.jiwenpeng01\\Desktop\\cs\\code\\RoguelikeApp\\RoguelikeClient'
];

for (const BASE of targets) {
    console.log(`\n===== ${BASE} =====`);
    const SCRIPTS_DIR = path.join(BASE, 'assets', 'scripts');
    const SCENES_DIR = path.join(BASE, 'assets', 'scenes', 'scripts');
    const SHARED_DIR = path.join(BASE, 'assets', 'shared');

    function walk(dir, cb) {
        if (!fs.existsSync(dir)) return;
        fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
            const f = path.join(dir, e.name);
            e.isDirectory() ? walk(f, cb) : e.name.endsWith('.ts') && cb(f);
        });
    }

    // 1. 替换 @rtd/shared → 相对路径
    let count = 0;
    const depthMap = {};
    walk(SCRIPTS_DIR, (f) => {
        const rel = path.relative(SCRIPTS_DIR, f);
        depthMap[rel] = '../'.repeat(rel.split(path.sep).length) + 'shared/index';
    });

    walk(SCRIPTS_DIR, (f) => {
        let c = fs.readFileSync(f, 'utf8');
        const rel = path.relative(SCRIPTS_DIR, f);
        const oldC = c;
        c = c.replace(/from\s+['"]@rtd\/shared['"]/g, `from '${depthMap[rel]}'`);
        if (c !== oldC) { fs.writeFileSync(f, c, 'utf8'); console.log('  ✅', rel); count++; }
    });

    const tpFile = path.join(SCENES_DIR, 'TowerPickPanelUI.ts');
    if (fs.existsSync(tpFile)) {
        let c = fs.readFileSync(tpFile, 'utf8');
        c = c.replace(/from\s+['"]@rtd\/shared['"]/g, `from '../../shared/index'`);
        fs.writeFileSync(tpFile, c, 'utf8');
        console.log('  ✅ scenes/scripts/TowerPickPanelUI.ts'); count++;
    }
    console.log(`  替换: ${count} 个文件`);

    // 2. 清理 shared 残留
    if (fs.existsSync(SHARED_DIR)) {
        const files = fs.readdirSync(SHARED_DIR);
        for (const f of files) {
            if (f.endsWith('.ts.meta') || f.endsWith('.ts')) continue;
            fs.unlinkSync(path.join(SHARED_DIR, f));
        }
        console.log('  清理 shared 完成');
    }

    // 3. 修复 tsconfig
    const tsconfigPath = path.join(BASE, 'tsconfig.json');
    fs.writeFileSync(tsconfigPath, JSON.stringify({
        "extends": "./temp/tsconfig.cocos.json",
        "compilerOptions": { "strict": false }
    }, null, 2));
    console.log('  tsconfig 修复完成');
}
console.log('\n===== 全部完成 =====');
