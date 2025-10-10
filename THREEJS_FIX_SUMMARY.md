# Fix: Multiple Three.js Import Sources

## Problem
The project had **two different sources** for Three.js and related libraries:

1. **CDN via importmap** in `index.html` - pointing to `https://aistudiocdn.com/three@^0.180.0`
2. **npm packages** in `package.json` - `"three": "^0.180.0"`

This dual-source setup can cause:
- Multiple instances of Three.js loaded simultaneously
- Runtime conflicts where Three.js objects from one instance don't recognize objects from another
- Increased bundle size
- Inconsistent behavior between development and production

## Solution
Removed the CDN-based approach and consolidated to use **only npm packages bundled by Vite**:

### Changes Made:

1. **index.html**: Removed the entire `<script type="importmap">` block that defined CDN URLs for:
   - `three` and `three/`
   - `@react-three/fiber`
   - `@react-three/drei`
   - `react` and `react-dom` (also removed for consistency)

2. **service-worker.js**: 
   - Removed CDN URLs from cache list (three, react-three/fiber, react-three/drei, react, react-dom)
   - Removed special CDN handling logic for `aistudiocdn.com`
   - Updated cache version to `v2` to invalidate old caches
   - Kept only TailwindCSS CDN (which is acceptable for styling)

3. **package.json**: No changes - kept existing npm dependencies:
   - `"three": "^0.180.0"`
   - `"@react-three/fiber": "^9.3.0"`
   - `"@react-three/drei": "^10.7.6"`
   - `"react": "^19.2.0"`
   - `"react-dom": "^19.2.0"`

## Result
✅ **Single Three.js instance**: All Three.js imports now resolve to the same package from node_modules, bundled by Vite

✅ **Consistent behavior**: Development and production use the same module resolution

✅ **Better performance**: No duplicate library downloads or loading

## Verification
Run: `npm run dev` - Server starts successfully and modules are resolved from node_modules
