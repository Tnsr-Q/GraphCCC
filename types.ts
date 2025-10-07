export namespace G3D {
  export type Point = {
    x: number;
    y: number;
    z: number;
  };

  export type Color = {
    r: number;
    g: number;
    b: number;
  };

  export interface G3DError {
    line: number;
    message: string;
  }

  // Base command structure
  export interface Command {
    type: string;
    line: number;
  }

  // Command Implementations
  export interface Plot3DCommand extends Command {
    type: 'PLOT3D';
    func: (x: number, y: number, n: number) => number;
    funcHash: string; // Stable identity for memoization
    usesN: boolean; // Whether function uses 'n' parameter
  }

  export interface Circle3DCommand extends Command {
    type: 'CIRCLE3D';
    center: Point;
    radius: number;
    color: Color;
  }

  export interface TextCommand extends Command {
    type: 'TEXT';
    position: Point;
    text: string;
  }

  export interface PlotPoint3DCommand extends Command {
    type: 'PLOT_POINT3D';
    position: Point;
    color: Color;
    size: number;
  }
  
  export interface SetViewCommand extends Command {
    type: 'SET_VIEW';
    azimuth: number; // angle around y-axis
    elevation: number; // angle above xz-plane
  }

  export interface SetGridCommand extends Command {
    type: 'SET_GRID';
    visible: boolean;
  }

  export interface SetAxesCommand extends Command {
    type: 'SET_AXES';
    visible: boolean;
  }

  export type AnyCommand = 
    | Plot3DCommand 
    | Circle3DCommand
    | TextCommand
    | PlotPoint3DCommand
    | SetViewCommand
    | SetGridCommand
    | SetAxesCommand;

  export interface Scene {
    commands: AnyCommand[];
    errors?: G3DError[];
  }
}