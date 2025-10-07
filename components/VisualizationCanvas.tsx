import React, { useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './Scene';
import type { G3D } from '../types';
import type { Scene as ThreeScene } from 'three';
import * as THREE from 'three';

interface VisualizationCanvasProps {
  parsedScene: G3D.Scene | null;
  nValue: number;
  sceneRef: MutableRefObject<ThreeScene | null>;
  isRunning: boolean;
}

export const VisualizationCanvas: React.FC<VisualizationCanvasProps> = ({ parsedScene, nValue, sceneRef, isRunning }) => {
  
  const cameraPosition = useMemo(() => {
    const viewCommand = parsedScene?.commands.find(c => c.type === 'SET_VIEW') as G3D.SetViewCommand | undefined;
    if (viewCommand) {
      const { azimuth, elevation } = viewCommand;
      const radius = 10; // Default radius from camera to origin
      const phi = THREE.MathUtils.degToRad(90 - elevation);
      const theta = THREE.MathUtils.degToRad(azimuth);

      return new THREE.Vector3(
        radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
      );
    }
    return new THREE.Vector3(5, 5, 5); // Default position
  }, [parsedScene]);
  
  return (
    <main className="flex-grow h-full bg-base-100">
      {isRunning && parsedScene ? (
        <Canvas 
          camera={{ position: cameraPosition, fov: 75 }}
          onCreated={({ scene }) => {
            sceneRef.current = scene;
          }}
        >
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
