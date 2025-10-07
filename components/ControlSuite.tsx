
import React, { useRef, useState, useCallback, MutableRefObject } from 'react';
import type { Scene, Camera } from 'three';
import { exportSceneToSVG } from '../lib/svgExport';
import type { G3D } from '../types';

interface ControlSuiteProps {
  script: string;
  setScript: (script: string) => void;
  nValue: number;
  setNValue: (value: number) => void;
  onParseAndRun: () => void;
  isRunning: boolean;
  sceneRef: MutableRefObject<{ scene: Scene; camera: Camera; } | null>;
  errors: G3D.G3DError[] | null;
}

const Button: React.FC<{ onClick: () => void; children: React.ReactNode; className?: string, disabled?: boolean }> = ({ onClick, children, className, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 rounded-md font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-base-200 ${className} disabled:bg-base-300 disabled:text-base-content/50 disabled:cursor-not-allowed`}
  >
    {children}
  </button>
);

export const ControlSuite: React.FC<ControlSuiteProps> = ({
  script,
  setScript,
  nValue,
  setNValue,
  onParseAndRun,
  isRunning,
  sceneRef,
  errors,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const handleSvgExport = useCallback(() => {
    if (sceneRef.current) {
      exportSceneToSVG(sceneRef.current.scene, sceneRef.current.camera);
    } else {
      console.error("Scene or camera not available for SVG export.");
    }
  }, [sceneRef]);

  const startRecording = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        console.error("Canvas element not found for recording.");
        return;
    }
    const stream = canvas.captureStream(30); // 30 FPS
    mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'video/webm' });
    
    mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
        }
    };

    mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'g3d-capture.webm';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        recordedChunksRef.current = [];
    };

    mediaRecorderRef.current.start();
    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
  }, []);

  return (
    <aside className="w-1/3 max-w-lg h-full bg-base-200 flex flex-col p-4 space-y-4 border-r border-base-100 shadow-lg">
      <header>
        <h1 className="text-2xl font-bold text-primary">GraphForge Core</h1>
        <p className="text-sm text-base-content/70">G3D-BASIC Visualization Engine</p>
      </header>

      <div className="flex-grow flex flex-col bg-base-300 rounded-lg p-1">
        <label htmlFor="script-editor" className="text-xs font-semibold text-base-content/80 px-2 py-1">G3D-BASIC Script</label>
        <textarea
          id="script-editor"
          value={script}
          onChange={(e) => setScript(e.target.value)}
          className="flex-grow w-full bg-base-100 rounded-md p-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          spellCheck="false"
        />
      </div>

      <div className="bg-base-300 p-4 rounded-lg space-y-4">
        <Button onClick={onParseAndRun} className="w-full bg-primary text-base-100 hover:bg-primary/80">
          Parse & Render
        </Button>
        {errors && errors.length > 0 && (
          <div className="max-h-32 overflow-y-auto text-red-400 text-xs p-3 bg-red-900/50 rounded-md space-y-2">
            <p className="font-bold sticky top-0 bg-red-900/50 -mx-3 -mt-3 px-3 pt-2 pb-1">Script Errors:</p>
            <ul className="space-y-1">
              {errors.map((err, index) => (
                <li key={index} className="flex">
                  <span className="font-semibold text-red-300/80 mr-2 w-12 text-right">L{err.line}:</span>
                  <span className="flex-1">{err.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="bg-base-300 p-4 rounded-lg space-y-4">
        <h2 className="font-semibold text-base-content/80">Real-time Controls</h2>
        <div>
          <label htmlFor="n-slider" className="text-sm flex justify-between">
            <span>Parameter 'n'</span>
            <span>{nValue.toFixed(2)}</span>
          </label>
          <input
            id="n-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={nValue}
            onChange={(e) => setNValue(parseFloat(e.target.value))}
            className="w-full h-2 bg-base-100 rounded-lg appearance-none cursor-pointer"
            disabled={!isRunning}
          />
        </div>
      </div>

      <div className="bg-base-300 p-4 rounded-lg space-y-3">
        <h2 className="font-semibold text-base-content/80">Export</h2>
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={handleSvgExport} className="bg-secondary text-base-100 hover:bg-secondary/80" disabled={!isRunning}>
            SVG
          </Button>
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            className={`${isRecording ? 'bg-accent hover:bg-accent/80' : 'bg-secondary hover:bg-secondary/80'} text-base-100`}
            disabled={!isRunning}
          >
            {isRecording ? 'Stop Recording' : 'Record Video'}
          </Button>
        </div>
      </div>
    </aside>
  );
};
