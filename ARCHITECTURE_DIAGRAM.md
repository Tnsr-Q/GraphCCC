# Architecture: Three.js Module Resolution

## Before Fix ❌

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser Environment                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  index.html                                                   │
│  ┌─────────────────────────────────────────┐                │
│  │  <script type="importmap">              │                │
│  │  {                                       │                │
│  │    "three": "https://aistudiocdn.com/   │ ◄──┐          │
│  │             three@^0.180.0"             │    │          │
│  │  }                                       │    │          │
│  └─────────────────────────────────────────┘    │          │
│                                                   │          │
│  App Code (Scene.tsx, etc.)                      │          │
│  ┌─────────────────────────────────────────┐    │          │
│  │  import * as THREE from 'three'         │ ───┘          │
│  │                                         │                │
│  │  Result: Loads from CDN                 │ ───┐          │
│  └─────────────────────────────────────────┘    │          │
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────┐
                                    │  Three.js Instance #1     │
                                    │  from CDN                 │
                                    └───────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Vite Build System                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  package.json                                                 │
│  ┌─────────────────────────────────────────┐                │
│  │  "dependencies": {                      │                │
│  │    "three": "^0.180.0"                  │ ◄──┐          │
│  │  }                                       │    │          │
│  └─────────────────────────────────────────┘    │          │
│                                                   │          │
│  Vite Bundler                                     │          │
│  ┌─────────────────────────────────────────┐    │          │
│  │  Resolves 'three' to node_modules/three │ ───┘          │
│  │                                         │                │
│  │  Result: Bundles from npm               │ ───┐          │
│  └─────────────────────────────────────────┘    │          │
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────┐
                                    │  Three.js Instance #2     │
                                    │  from node_modules        │
                                    └───────────────────────────┘

                      ⚠️  TWO DIFFERENT INSTANCES! ⚠️
                      Can cause runtime conflicts!


## After Fix ✅

┌─────────────────────────────────────────────────────────────┐
│                      Browser Environment                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  index.html                                                   │
│  ┌─────────────────────────────────────────┐                │
│  │  (No importmap for Three.js)            │                │
│  │                                         │                │
│  │  Vite serves bundled modules            │                │
│  └─────────────────────────────────────────┘                │
│                                                               │
│  App Code (Scene.tsx, etc.)                                   │
│  ┌─────────────────────────────────────────┐                │
│  │  import * as THREE from 'three'         │ ───┐          │
│  │                                         │    │          │
│  │  Result: Vite resolves to bundled code │    │          │
│  └─────────────────────────────────────────┘    │          │
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Vite Build System                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  package.json                                                 │
│  ┌─────────────────────────────────────────┐                │
│  │  "dependencies": {                      │                │
│  │    "three": "^0.180.0"                  │ ◄──┐          │
│  │  }                                       │    │          │
│  └─────────────────────────────────────────┘    │          │
│                                                   │          │
│  node_modules/three                               │          │
│  ┌─────────────────────────────────────────┐    │          │
│  │  • Three.js v0.180.0                    │ ◄──┘          │
│  │  • All submodules                       │                │
│  │  • ParametricGeometry                   │                │
│  │  • SVGRenderer                          │                │
│  └─────────────────────────────────────────┘                │
│                                                   │          │
│  Vite Bundler                                     │          │
│  ┌─────────────────────────────────────────┐    │          │
│  │  • Bundles all modules                  │    │          │
│  │  • Tree shaking                         │    │          │
│  │  • Single output bundle                 │ ───┘          │
│  └─────────────────────────────────────────┘    │          │
│                                                   │          │
└───────────────────────────────────────────────────┼──────────┘
                                                    │
                                                    ▼
                                    ┌───────────────────────────┐
                                    │  Three.js Instance        │
                                    │  (Single, from npm)       │
                                    └───────────────────────────┘

                        ✅  ONE INSTANCE ONLY! ✅
                    Consistent and conflict-free!


## Import Resolution Flow

### Before:
```
Component:  import * as THREE from 'three'
                          ↓
            Browser sees importmap → CDN
            Vite dev/build → node_modules
                          ↓
                   TWO INSTANCES ❌
```

### After:
```
Component:  import * as THREE from 'three'
                          ↓
                  Vite resolver
                          ↓
                  node_modules/three
                          ↓
                   ONE INSTANCE ✅
```
