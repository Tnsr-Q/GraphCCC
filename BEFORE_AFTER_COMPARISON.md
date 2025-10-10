# Before vs After: Three.js Import Sources

## Before (❌ Multiple Sources)

### index.html
```html
<script type="importmap">
{
  "imports": {
    "three/": "https://aistudiocdn.com/three@^0.180.0/",
    "three": "https://aistudiocdn.com/three@^0.180.0",
    "@react-three/fiber": "https://aistudiocdn.com/@react-three/fiber@^9.3.0",
    "@react-three/drei": "https://aistudiocdn.com/@react-three/drei@^10.7.6"
  }
}
</script>
```

### package.json
```json
{
  "dependencies": {
    "three": "^0.180.0",
    "@react-three/fiber": "^9.3.0",
    "@react-three/drei": "^10.7.6"
  }
}
```

### service-worker.js
```javascript
const urlsToCache = [
  'https://aistudiocdn.com/three@^0.180.0',
  'https://aistudiocdn.com/@react-three/fiber@^9.3.0',
  'https://aistudiocdn.com/@react-three/drei@^10.7.6',
  // ...
];
```

**Problem:** 
- importmap resolves `import * as THREE from 'three'` → CDN
- Vite bundler resolves imports → node_modules
- **Result: Two different Three.js instances loaded!**

---

## After (✅ Single Source)

### index.html
```html
<!-- No importmap for Three.js -->
```

### package.json (unchanged)
```json
{
  "dependencies": {
    "three": "^0.180.0",
    "@react-three/fiber": "^9.3.0",
    "@react-three/drei": "^10.7.6"
  }
}
```

### service-worker.js
```javascript
const urlsToCache = [
  // Three.js removed from CDN cache
  'https://cdn.tailwindcss.com' // Only TailwindCSS from CDN
];
```

**Solution:**
- All imports resolve → node_modules
- Vite bundles everything from npm packages
- **Result: Single Three.js instance!**

---

## Import Resolution Flow

### Before:
```
Browser Runtime:
  import * as THREE from 'three' 
    → importmap 
    → https://aistudiocdn.com/three@^0.180.0 ⚠️

Vite Dev/Build:
  import * as THREE from 'three'
    → node_modules/three ⚠️

TWO DIFFERENT INSTANCES! ❌
```

### After:
```
Browser Runtime (via Vite):
  import * as THREE from 'three'
    → Vite bundler
    → node_modules/three ✅

Vite Dev/Build:
  import * as THREE from 'three'
    → node_modules/three ✅

SINGLE INSTANCE! ✅
```

---

## Verification

Run the verification script:
```bash
node verify-single-threejs.js
```

Expected output:
```
✅ VERIFICATION PASSED: Single Three.js source confirmed
   Three.js will be bundled from node_modules by Vite.
   No duplicate instances will be loaded.
```
