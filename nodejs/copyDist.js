// 新添加用于支持DS源适配猫影视
// 导入所需模块
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 检查是否提供了目标路径
if (process.argv.length < 3) {
    console.error('Usage: node script.js <destination_path>');
    process.exit(1);
}

// 从命令行参数获取目标路径
const destinationPath = process.argv[2];

// 解析路径
const distPath = path.resolve(process.cwd(), 'dist');
const targetPath = path.resolve(destinationPath);

// 检查dist目录是否存在
if (!fs.existsSync(distPath)) {
    console.error(`Source directory does not exist: ${distPath}`);
    process.exit(1);
}

// 检查目标目录是否存在
if (!fs.existsSync(targetPath)) {
    console.error(`Target directory does not exist: ${targetPath}`);
    process.exit(1);
}

// 将文件从dist复制到目标
const copyFiles = (srcDir, destDir) => {
    const entries = fs.readdirSync(srcDir, { withFileTypes: true });

    entries.forEach((entry) => {
        const srcPath = path.join(srcDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
            // Create directory if it doesn't exist
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath);
            }
            // Recursively copy files
            copyFiles(srcPath, destPath);
        } else {
            // Copy file and overwrite if exists
            fs.copyFileSync(srcPath, destPath);
            console.log(`Copied: ${srcPath} -> ${destPath}`);
        }
    });
};

try {
    console.log(`Copying files from ${distPath} to ${targetPath}...`);
    copyFiles(distPath, targetPath);
    console.log('All files copied successfully.');
} catch (error) {
    console.error('Error during file copy:', error);
    process.exit(1);
}
