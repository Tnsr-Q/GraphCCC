
import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Scene as ThreeScene, Camera } from 'three';
import { ControlSuite } from './components/ControlSuite';
import { VisualizationCanvas } from './components/VisualizationCanvas';
import { parseG3D } from './lib/g3dParser';
import type { G3D } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

const defaultScript = `10 REM BLACK HOLE POTENTIAL - CCC SPECTRAL TOPOLOGY
20 REM Multi-pole resolvent landscape
30 REM Based on Theorem B.5: Phi(x,y) = sum |R_alpha|/|lambda-lambda_alpha|^2

40 SET RANGE X -1.5 TO 1.5
50 SET RANGE Y -1.5 TO 1.5  
60 SET RANGE Z 0 TO 50

70 REM Define the 5-pole black hole potential
80 DEF FNZ(X,Y) = 1.5/((X-0.9)^2+(Y-0.3)^2+0.05)
90 FNZ = FNZ + 2/((X-0.3)^2+(Y-0.9)^2+0.05)
100 FNZ = FNZ + 1.2/((X+0.6)^2+(Y-0.7)^2+0.05)
110 FNZ = FNZ + 1.8/((X+0.8)^2+(Y+0.5)^2+0.05)
120 FNZ = FNZ + 1.6/((X-0.5)^2+(Y+0.8)^2+0.05)

130 REM 3D Surface plot with enhanced features
140 PLOT3D FNZ(X,Y)

150 REM Color mapping by Chern number regions
160 COLOR MAP CUSTOM
170 REM Blue: C=0, Red: C=1, Green: C=-1
180 COLOR 0,0,255 FOR Z < 10    ; Basin regions
190 COLOR 255,0,0 FOR Z > 30 AND (X-0.9)^2+(Y-0.3)^2 < 0.2  ; Peak 1 - Chern 1
200 COLOR 0,255,0 FOR Z > 25 AND (X-0.3)^2+(Y-0.9)^2 < 0.2  ; Peak 2 - Chern -1
210 COLOR 255,0,0 FOR Z > 20 AND (X+0.8)^2+(Y+0.5)^2 < 0.2  ; Peak 3 - Chern 1

220 REM Draw Wilson loops around peaks (Berry phase integration paths)
230 CIRCLE3D 0.9,0.3,5 WITH RADIUS 0.3 COLOR 255,255,0  ; Yellow loop
240 CIRCLE3D 0.3,0.9,5 WITH RADIUS 0.3 COLOR 255,255,0
250 CIRCLE3D -0.8,-0.5,5 WITH RADIUS 0.3 COLOR 255,255,0

260 REM Animate experimental trajectory through parameter space
270 DEF FNX(T) = 1.2*SIN(2*PI*T)  ; JT parameter 1
280 DEF FNY(T) = 1.2*COS(2*PI*T)  ; JT parameter 2  
290 DEF FNZT(T) = FNZ(FNX(T),FNY(T)) + 0.5

300 FOR T = 0 TO 1 STEP 0.01
310   PLOT POINT3D FNX(T), FNY(T), FNZT(T) COLOR 255,0,255 SIZE 8
320   LABEL AT FNX(T), FNY(T), FNZT(T)+2 TEXT "JT="+STR(T)
330 NEXT T

340 REM Add contour lines at critical potential values
350 CONTOUR FNZ(X,Y) AT LEVELS 10,20,30,40

360 REM Information panels for each exceptional point
370 TEXT AT -1.4, -1.4, 45 "BLACK HOLE RESOLVENT LANDSCAPE"
380 TEXT AT -1.4, -1.3, 43 "Theorem B.5: Φ(λ) = Σ|R_α|/|λ-λ_α|²"

390 REM Peak annotations with topological data
400 TEXT AT 0.9, 0.3, 35 "EP1: C=1, η=+1"
410 TEXT AT 0.3, 0.9, 30 "EP2: C=-1, η=-1" 
420 TEXT AT -0.8, -0.5, 25 "EP3: C=1, η=+1"
430 TEXT AT -0.6, 0.7, 20 "EP4: C=0, η=+1"
440 TEXT AT 0.5, -0.8, 22 "EP5: C=0, η=+1"

450 REM Measurement outcome basins (Voronoi regions)
460 FILL POLYGON -1.5,-1.5,0 TO 0,0,0 TO -1.5,1.5,0 COLOR 100,100,255,128
470 FILL POLYGON 1.5,-1.5,0 TO 0,0,0 TO 1.5,1.5,0 COLOR 255,100,100,128

480 SET VIEW ANGLE 45, 30
490 SET GRID ON
500 SET AXES ON

510 REM Real-time resolvent trace display along trajectory
520 TEXT AT 1.0, -1.4, 40 "G(JT) = Tr[(I-E)^-1]"
530 FOR T = 0 TO 1 STEP 0.1
540   G_VALUE = FNZ(FNX(T),FNY(T))
550   TEXT AT FNX(T), FNY(T)-0.2, FNZT(T)+1 "G="+STR(INT(G_VALUE))
560 NEXT T

570 REM Critical exponent visualization
580 PLOT FUNCTION X, 40*(ABS(X-0.9))^(-0.5) FOR X = 0.5 TO 1.3 COLOR 0,255,255
590 TEXT AT 1.0, 1.4, 38 "ν=0.5 critical scaling"

600 END
`;

function App() {
  const [script, setScript] = useState(() => {
    try {
      return localStorage.getItem('g3d-script') || defaultScript;
    } catch {
      return defaultScript;
    }
  });
  const [nValue, setNValue] = useState(0.5);
  const [isRunning, setIsRunning] = useState(false);
  const [errors, setErrors] = useState<G3D.G3DError[] | null>(null);
  const [parsedScene, setParsedScene] = useState<G3D.Scene | null>(null);
  const sceneRef = useRef<{ scene: ThreeScene; camera: Camera } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('g3d-script', script);
    } catch (e) {
      console.error("Failed to save script to localStorage", e);
    }
  }, [script]);

  const handleParseAndRun = useCallback(() => {
    setErrors(null);
    const result = parseG3D(script);
    if (result.errors && result.errors.length > 0) {
      setErrors(result.errors);
      setIsRunning(false);
      setParsedScene({ commands: [] }); // Clear scene on error
    } else {
      setParsedScene(result);
      setIsRunning(true);
    }
  }, [script]);

  return (
    <div className="flex h-screen w-screen font-sans bg-base-200 text-base-content">
      <ControlSuite
        script={script}
        setScript={setScript}
        nValue={nValue}
        setNValue={setNValue}
        onParseAndRun={handleParseAndRun}
        isRunning={isRunning}
        sceneRef={sceneRef}
        errors={errors}
      />
      <ErrorBoundary>
        <VisualizationCanvas
          parsedScene={parsedScene}
          nValue={nValue}
          sceneRef={sceneRef}
          isRunning={isRunning}
        />
      </ErrorBoundary>
    </div>
  );
}

export default App;
