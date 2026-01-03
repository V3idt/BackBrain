#!/usr/bin/env node

/**
 * Bundle Size Analyzer
 * Analyzes and reports extension bundle size
 */

const fs = require('fs');
const path = require('path');

const TARGET_SIZE = 5 * 1024 * 1024; // 5MB

function getSize(filePath) {
    try {
        const stats = fs.statSync(filePath);
        return stats.size;
    } catch {
        return 0;
    }
}

function formatSize(bytes) {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function analyzeDirectory(dir, results = {}) {
    if (!fs.existsSync(dir)) return results;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
            analyzeDirectory(filePath, results);
        } else {
            const ext = path.extname(file);
            results[ext] = (results[ext] || 0) + stat.size;
        }
    }
    
    return results;
}

console.log('📦 BackBrain Bundle Size Analysis\n');

const extensionDist = path.join(__dirname, '..', 'packages', 'extension', 'dist');
const results = analyzeDirectory(extensionDist);

let totalSize = 0;
const breakdown = [];

for (const [ext, size] of Object.entries(results).sort((a, b) => b[1] - a[1])) {
    totalSize += size;
    breakdown.push({ ext, size });
}

console.log('Size by file type:');
breakdown.forEach(({ ext, size }) => {
    const percent = ((size / totalSize) * 100).toFixed(1);
    console.log(`  ${ext.padEnd(10)} ${formatSize(size).padStart(10)} (${percent}%)`);
});

console.log('\n' + '─'.repeat(50));
console.log(`Total Size:     ${formatSize(totalSize)}`);
console.log(`Target Size:    ${formatSize(TARGET_SIZE)}`);
console.log(`Status:         ${totalSize <= TARGET_SIZE ? '✅ PASS' : '❌ FAIL'}`);

if (totalSize > TARGET_SIZE) {
    console.log(`\n⚠️  Bundle exceeds target by ${formatSize(totalSize - TARGET_SIZE)}`);
    process.exit(1);
}

console.log('\n✅ Bundle size within target');
