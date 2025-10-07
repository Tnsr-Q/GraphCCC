import React, { useMemo, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Scene } from './Scene';
import type { G3D } from '../types';
import type { Scene as ThreeScene, Camera } from 'three';
import * as THREE from 'three';

interface VisualizationCanvasProps {
  parsedScene: G3D.Scene | null;
  nValue: number;
  sceneRef: MutableRefObject<{ scene: ThreeScene; camera: Camera; } | null>;
  isRunning: boolean;
}

const CameraController = ({ viewCommand }: { viewCommand?: G3D.SetViewCommand }) => {
  const { camera } = useThree();

  useEffect(() => {
    if (viewCommand) {
      const { azimuth, elevation } = viewCommand;
      const radius = 10;
      const phi = THREE.MathUtils.degToRad(90 - elevation);
      const theta = THREE.MathUtils.degToRad(azimuth);
      
      camera.position.set(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
      camera.lookAt(0, 0, 0);
    } else {
        camera.position.set(5, 5, 5);
        camera.lookAt(0, 0, 0);
    }
    camera.updateProjectionMatrix();
  }, [camera, viewCommand]);

  return null;
};


export const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({ parsedScene, nValue, sceneRef, isRunning }) => {
  
  const viewCommand = useMemo(() => 
    parsedScene?.commands.find(c => c.type === 'SET_VIEW') as G3D.SetViewCommand | undefined,
    [parsedScene]
  );
  
  return (
    <main className="flex-grow h-full bg-base-100">
      {isRunning && parsedScene ? (
        <Canvas 
          camera={{ fov: 75 }}
          onCreated={({ scene, camera }) => {
            sceneRef.current = { scene, camera };
          }}
        >
          <CameraController viewCommand={viewCommand} />
          <Scene parsedScene={parsedScene} nValue={nValue} />
        </Canvas>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-base-content/50">
          <p>Press "Parse & Render" to start visualization.</p>
        </div>
      )}
    </main>
  );
};