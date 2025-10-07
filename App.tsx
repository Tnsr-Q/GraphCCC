import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { Scene as ThreeScene, Camera } from 'three';
import { ControlSuite } from './components/ControlSuite';
import { VisualizationCanvas } from './components/VisualizationCanvas';
import { parseG3D } from './lib/g3dParser';
import type { G3D } from './types';
import { ErrorBoundary } from './components/ErrorBoundary';

const defaultScript = `10 REM DYNAMIC SURFACE - MORPHING WITH 'N' PARAMETER
20 REM Demonstrates dynamic visualization using the n slider
30 REM n=0: minimal peaks, n=1: maximum intensity

40 SET RANGE X -1.5 TO 1.5
50 SET RANGE Y -1.5 TO 1.5  
60 SET RANGE Z 0 TO 50

70 REM Define dynamic function with 'n' parameter
80 REM The surface morphs as you move the slider!
90 DEF FNZ(X,Y) = (1+n*2)/((X-0.9)^2+(Y-0.3)^2+0.05)
100 FNZ = FNZ + (1.5+n*1.5)/((X-0.3)^2+(Y-0.9)^2+0.05)
110 FNZ = FNZ + (0.8+n*0.8)/((X+0.6)^2+(Y-0.7)^2+0.05)
120 FNZ = FNZ + (1.2+n*1.2)/((X+0.8)^2+(Y+0.5)^2+0.05)
130 FNZ = FNZ + (1.0+n*1.0)/((X-0.5)^2+(Y+0.8)^2+0.05)

140 REM 3D Surface plot
150 PLOT3D FNZ(X,Y)

160 REM Wilson loops around peaks
170 CIRCLE3D 0.9,0.3,5 WITH RADIUS 0.3 COLOR 255,255,0
180 CIRCLE3D 0.3,0.9,5 WITH RADIUS 0.3 COLOR 255,255,0
190 CIRCLE3D -0.8,-0.5,5 WITH RADIUS 0.3 COLOR 255,255,0

200 REM Animate trajectory through parameter space
210 DEF FNX(T) = 1.2*SIN(2*PI*T)
220 DEF FNY(T) = 1.2*COS(2*PI*T)  
230 DEF FNZT(T) = FNZ(FNX(T),FNY(T)) + 0.5

240 FOR T = 0 TO 1 STEP 0.02
250   PLOT POINT3D FNX(T), FNY(T), FNZT(T) COLOR 255,0,255 SIZE 8
260 NEXT T

270 REM Information panel
280 TEXT AT -1.4, -1.4, 45 "DYNAMIC MORPHING SURFACE"
290 TEXT AT -1.4, -1.3, 43 "Move slider to morph!"

300 SET VIEW ANGLE 45, 30
310 SET GRID ON
320 SET AXES ON

330 END
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
      setParsedScene({ commands: [] });
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