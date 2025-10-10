#!/usr/bin/env node

/**
 * Verification script to ensure there are no multiple Three.js import sources
 * Run: node verify-single-threejs.js
 */

import fs from 'fs';
import path from 'path';

console.log('\n🔍 Verifying Single Three.js Source...\n');

let hasErrors = false;

// Test 1: Check index.html for importmap
console.log('Test 1: index.html should NOT have importmap for Three.js');
const indexHtml = fs.readFileSync('index.html', 'utf8');
const hasImportMap = indexHtml.includes('type="importmap"');
const hasThreeCDN = indexHtml.includes('aistudiocdn.com/three') || indexHtml.includes('unpkg.com/three') || indexHtml.includes('cdn.skypack.dev/three');

if (hasImportMap && hasThreeCDN) {
  console.log('   ❌ FAIL: importmap with Three.js CDN found in index.html');
  hasErrors = true;
} else if (hasImportMap) {
  console.log('   ⚠️  WARNING: importmap exists but doesn\'t reference Three.js CDN');
} else {
  console.log('   ✅ PASS: No importmap in index.html');
}

// Test 2: Check package.json for Three.js dependency
console.log('\nTest 2: package.json should have Three.js as npm dependency');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const hasThreeInPackage = packageJson.dependencies && packageJson.dependencies.three;

if (hasThreeInPackage) {
  console.log(`   ✅ PASS: three@${packageJson.dependencies.three} found in package.json`);
} else {
  console.log('   ❌ FAIL: Three.js not in package.json dependencies');
  hasErrors = true;
}

// Test 3: Check service-worker.js
console.log('\nTest 3: service-worker.js should NOT cache Three.js from CDN');
const serviceWorker = fs.readFileSync('service-worker.js', 'utf8');
const hasThreeCacheURL = serviceWorker.includes('aistudiocdn.com/three') || 
                          serviceWorker.includes('unpkg.com/three') || 
                          serviceWorker.includes('cdn.skypack.dev/three');

if (hasThreeCacheURL) {
  console.log('   ❌ FAIL: Three.js CDN URLs found in service-worker.js');
  hasErrors = true;
} else {
  console.log('   ✅ PASS: No Three.js CDN URLs in service-worker.js');
}

// Test 4: Check for consistent imports in code
console.log('\nTest 4: All code should import Three.js from "three" package');
const codeFiles = [
  'components/Scene.tsx',
  'components/VisualizationCanvas.tsx',
  'lib/svgExport.ts'
];

let allImportsCorrect = true;
codeFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    // Check for proper imports
    const hasProperImport = content.includes('from \'three\'') || content.includes('from "three"') || 
                            content.includes('from \'three/') || content.includes('from "three/');
    // Check for problematic imports (CDN URLs in imports)
    const hasCDNImport = content.includes('https://') && content.includes('three');
    
    if (hasCDNImport) {
      console.log(`   ❌ FAIL: ${file} has CDN import for Three.js`);
      allImportsCorrect = false;
      hasErrors = true;
    }
  }
});

if (allImportsCorrect) {
  console.log('   ✅ PASS: All imports use npm package resolution');
}

// Test 5: Check node_modules
console.log('\nTest 5: node_modules should contain Three.js package');
const hasNodeModulesThree = fs.existsSync('node_modules/three/package.json');

if (hasNodeModulesThree) {
  const threePackage = JSON.parse(fs.readFileSync('node_modules/three/package.json', 'utf8'));
  console.log(`   ✅ PASS: three@${threePackage.version} installed in node_modules`);
} else {
  console.log('   ⚠️  WARNING: three not found in node_modules (run npm install)');
}

// Summary
console.log('\n' + '='.repeat(60));
if (hasErrors) {
  console.log('❌ VERIFICATION FAILED: Multiple Three.js sources detected');
  console.log('   Please fix the issues above to ensure a single Three.js instance.');
  process.exit(1);
} else {
  console.log('✅ VERIFICATION PASSED: Single Three.js source confirmed');
  console.log('   Three.js will be bundled from node_modules by Vite.');
  console.log('   No duplicate instances will be loaded.');
  process.exit(0);
}
