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
            // 如果目录不存在，则创建该目录
            if (!fs.existsSync(destPath)) {
                fs.mkdirSync(destPath);
            }
            //递归复制文件
            copyFiles(srcPath, destPath);
        } else {
            // 复制文件并覆盖（如果存在）
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
