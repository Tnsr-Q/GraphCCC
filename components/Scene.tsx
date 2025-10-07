
import React, { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { G3D } from '../types';
import { OrbitControls, Text, Line, Points, Point } from '@react-three/drei';
import { ParametricGeometry } from 'three/examples/jsm/geometries/ParametricGeometry.js';

interface SceneProps {
  parsedScene: G3D.Scene;
  nValue: number;
}

const Surface: React.FC<{ command: G3D.Plot3DCommand }> = ({ command }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  const geometry = useMemo(() => {
    const uMin = -1.5, uMax = 1.5, vMin = -1.5, vMax = 1.5;
    const slices = 50, stacks = 50;
    
    const surfaceFunction = (u: number, v: number, target: THREE.Vector3) => {
      const x = u * (uMax - uMin) + uMin;
      const y = v * (vMax - vMin) + vMin;
      const z = command.func(x, y);
      target.set(x, y, z);
    };

    return new ParametricGeometry(surfaceFunction, slices, stacks);
  }, [command.func]);

  useEffect(() => {
    // Cleanup function to dispose of geometry and material
    return () => {
      geometry.dispose();
      // We can check if the material is an array or single, but here we know it's single
      const material = meshRef.current?.material as THREE.Material;
      if (material) {
        material.dispose();
      }
    };
  }, [geometry]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial color="#3abff8" side={THREE.DoubleSide} wireframe={false} />
    </mesh>
  );
};

const Circle3D: React.FC<{ command: G3D.Circle3DCommand }> = ({ command }) => {
    const points = useMemo(() => {
        const pts = [];
        const segments = 32;
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            pts.push(new THREE.Vector3(
                command.center.x + Math.cos(theta) * command.radius,
                command.center.y + Math.sin(theta) * command.radius,
                command.center.z
            ));
        }
        return pts;
    }, [command]);
    const color = new THREE.Color(command.color.r, command.color.g, command.color.b);
    return <Line points={points} color={color} lineWidth={3} />;
};

const TextLabel: React.FC<{ command: G3D.TextCommand }> = ({ command }) => {
  return (
    <Text
      position={[command.position.x, command.position.y, command.position.z]}
      color="white"
      fontSize={0.2}
      maxWidth={20}
      lineHeight={1}
      textAlign="center"
      anchorX="center"
      anchorY="middle"
    >
      {command.text}
    </Text>
  );
};

const Trajectory: React.FC<{ points: G3D.Point[], color: G3D.Color }> = ({ points, color }) => {
    const threeColor = new THREE.Color(color.r, color.g, color.b);
    return (
        <Points>
            <pointsMaterial color={threeColor} size={0.1} sizeAttenuation />
            {points.map((p, i) => (
                <Point key={i} position={new THREE.Vector3(p.x, p.y, p.z)} />
            ))}
        </Points>
    );
};


export const Scene: React.FC<SceneProps> = ({ parsedScene }) => {
  const showGrid = useMemo(() => parsedScene.commands.some(c => c.type === 'SET_GRID' && c.visible), [parsedScene]);
  const showAxes = useMemo(() => parsedScene.commands.some(c => c.type === 'SET_AXES' && c.visible), [parsedScene]);

  // Group trajectory points for better performance
  const trajectoryPoints = useMemo(() => {
      const points = parsedScene.commands.filter(c => c.type === 'PLOT_POINT3D') as G3D.PlotPoint3DCommand[];
      if (points.length === 0) return null;
      return {
          positions: points.map(p => p.position),
          color: points[0].color, // Assume all points in a trajectory have the same color
      }
  }, [parsedScene]);

  return (
    <>
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 10, 10]} intensity={Math.PI} />
      
      {showGrid && <gridHelper args={[10, 10]} />}
      {showAxes && <axesHelper args={[5]} />}

      {parsedScene.commands.map((command, index) => {
        switch (command.type) {
          case 'PLOT3D':
            return <Surface key={index} command={command} />;
          case 'CIRCLE3D':
            return <Circle3D key={index} command={command} />;
          case 'TEXT':
            return <TextLabel key={index} command={command} />;
          // PLOT_POINT3D is handled by the Trajectory component below
          case 'PLOT_POINT3D':
            return null; 
          default:
            return null;
        }
      })}
      
      {trajectoryPoints && <Trajectory points={trajectoryPoints.positions} color={trajectoryPoints.color} />}
      
      <OrbitControls makeDefault />
    </>
  );
};
