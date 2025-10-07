
import * as THREE from 'three';
// SVGRenderer is an add-on, and needs to be imported from the examples directory.
import { SVGRenderer } from 'three/examples/jsm/renderers/SVGRenderer.js';

export function exportSceneToSVG(scene: THREE.Scene, camera: THREE.Camera) {
  const renderer = new SVGRenderer();
  
  // Get canvas dimensions to match aspect ratio
  const canvas = document.querySelector('canvas');
  const width = canvas ? canvas.clientWidth : 800;
  const height = canvas ? canvas.clientHeight : 600;

  renderer.setSize(width, height);
  renderer.render(scene, camera);

  const svgString = renderer.domElement.outerHTML;
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'scene.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
