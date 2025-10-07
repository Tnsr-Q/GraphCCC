import { G3D } from '../types';

class ParserState {
    // Storing compiled functions and built-in Math functions
    // FIX: Allow numbers for constants like PI.
    functions: Record<string, Function | number> = {
        SIN: Math.sin,
        COS: Math.cos,
        ABS: Math.abs,
        STR: (v: any) => String(v),
        INT: Math.trunc,
        PI: Math.PI,
    };
    functionBodies: Record<string, { args: string[], body: string }> = {};
    errors: G3D.G3DError[] = [];
    commands: G3D.AnyCommand[] = [];

    addError(line: number, message: string) {
        this.errors.push({ line, message });
    }
}

function jsifyExpression(expr: string): string {
    return expr.replace(/\^/g, '**');
}

function evaluateExpression(expr: string, state: ParserState, scope: Record<string, number>): number {
    const context = { ...state.functions, ...scope };
    const contextNames = Object.keys(context);
    const contextValues = Object.values(context);
    const jsExpr = jsifyExpression(expr);

    try {
        const evaluator = new Function(...contextNames, `return ${jsExpr}`);
        const result = evaluator(...contextValues);
        if (typeof result !== 'number' || !isFinite(result)) {
            return 0; // Default for invalid results like NaN/Infinity
        }
        return result;
    } catch (e: any) {
        throw new Error(`Failed to evaluate expression "${expr}": ${e.message}`);
    }
}

function parseFunctionDefinition(line: string, state: ParserState, lineNumber: number) {
    const simpleDefMatch = line.match(/DEF\s+(FN[A-Z0-9]+)\((.*?)\)\s*=\s*(.*)/i);
    const continuationMatch = line.match(/(FN[A-Z0-9]+)\s*=\s*\1\s*\+\s*(.*)/i);
    
    let funcName: string, args: string[], body: string;

    if (simpleDefMatch) {
        funcName = simpleDefMatch[1].toUpperCase();
        args = simpleDefMatch[2].split(',').map(s => s.trim()).filter(Boolean);
        body = simpleDefMatch[3];
    } else if (continuationMatch) {
        funcName = continuationMatch[1].toUpperCase();
        const addition = continuationMatch[2];
        const oldBodyData = state.functionBodies[funcName];
        if (!oldBodyData) {
            state.addError(lineNumber, `Function ${funcName} not defined before continuation.`);
            return;
        }
        args = oldBodyData.args;
        body = `(${oldBodyData.body}) + (${addition})`;
    } else {
        state.addError(lineNumber, `Invalid function definition syntax.`);
        return;
    }
    
    state.functionBodies[funcName] = { args, body };
    const jsBody = jsifyExpression(body);
    try {
        const funcDeps = Object.keys(state.functions);
        const funcDepValues = Object.values(state.functions);
        const func = new Function(...funcDeps, ...args, `return ${jsBody};`);
        state.functions[funcName] = func.bind(null, ...funcDepValues);
    } catch (e: any) {
        state.addError(lineNumber, `Invalid function body for ${funcName}: ${e.message}`);
    }
}

function parsePlot3D(line: string, state: ParserState, lineNumber: number) {
    const match = line.match(/PLOT3D\s+([A-Z0-9]+)\(X,Y\)/i);
    if (match) {
        const funcName = match[1].toUpperCase();
        if (state.functions[funcName]) {
            state.commands.push({
                type: 'PLOT3D',
                func: state.functions[funcName] as (x: number, y: number) => number,
                line: lineNumber,
            });
        } else {
            state.addError(lineNumber, `Function ${funcName} not defined for PLOT3D.`);
        }
    } else {
        state.addError(lineNumber, 'Invalid PLOT3D syntax.');
    }
}

function parseCircle3D(line: string, state: ParserState, lineNumber: number) {
    const match = line.match(/CIRCLE3D\s+([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\s+WITH\s+RADIUS\s+([-\d.]+)\s+COLOR\s+([\d]+),\s*([\d]+),\s*([\d]+)/i);
    if (match) {
        const [, x, y, z, radius, r, g, b] = match.map(parseFloat);
        state.commands.push({
            type: 'CIRCLE3D',
            center: { x, y, z },
            radius,
            color: { r: r / 255, g: g / 255, b: b / 255 },
            line: lineNumber,
        });
    } else {
        state.addError(lineNumber, 'Invalid CIRCLE3D syntax.');
    }
}

function parseText(line: string, state: ParserState, lineNumber: number) {
    const match = line.match(/TEXT\s+AT\s+([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\s+"(.*?)"/i);
    if (match) {
        const [, x, y, z, text] = match;
        state.commands.push({
            type: 'TEXT',
            position: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) },
            text,
            line: lineNumber,
        });
    } else {
        state.addError(lineNumber, 'Invalid TEXT AT syntax.');
    }
}

function parsePlotPoint3D(line: string, state: ParserState, lineNumber: number, scope: Record<string, number>) {
    const match = line.match(/PLOT\s+POINT3D\s+(.*?)\s+COLOR\s+([\d]+),\s*([\d]+),\s*([\d]+)\s+SIZE\s+([\d.]+)/i);
    if (match) {
        const [, posStr, r, g, b, size] = match;
        const posParts = posStr.split(',').map(s => s.trim());
        if (posParts.length !== 3) {
            state.addError(lineNumber, 'PLOT POINT3D requires 3 coordinates.');
            return;
        }
        try {
            const x = evaluateExpression(posParts[0], state, scope);
            const y = evaluateExpression(posParts[1], state, scope);
            const z = evaluateExpression(posParts[2], state, scope);

            state.commands.push({
                type: 'PLOT_POINT3D',
                position: { x, y, z },
                color: { r: parseFloat(r) / 255, g: parseFloat(g) / 255, b: parseFloat(b) / 255 },
                size: parseFloat(size),
                line: lineNumber,
            });
        } catch (e: any) {
            state.addError(lineNumber, e.message);
        }
    } else {
        state.addError(lineNumber, 'Invalid PLOT POINT3D syntax.');
    }
}

interface ForLoop { variable: string; start: number; end: number; step: number; }

function parseFor(line: string, state: ParserState, lineNumber: number): ForLoop | null {
    const match = line.match(/FOR\s+(\w+)\s*=\s*([-\d.]+)\s+TO\s+([-\d.]+)\s+STEP\s+([-\d.]+)/i);
    if (match) {
        const [, variable, start, end, step] = match;
        return { variable, start: parseFloat(start), end: parseFloat(end), step: parseFloat(step) };
    }
    state.addError(lineNumber, 'Invalid FOR loop syntax.');
    return null;
}

function evaluateLoop(loop: ForLoop, bodyLines: { content: string, number: number }[], state: ParserState) {
    for (let i = loop.start; i <= loop.end; i += loop.step) {
        const scope = { [loop.variable]: i };
        for (const line of bodyLines) {
            if (line.content.toUpperCase().startsWith('PLOT POINT3D')) {
                parsePlotPoint3D(line.content, state, line.number, scope);
            }
        }
    }
}

function parseSetView(line: string, state: ParserState, lineNumber: number) {
    const match = line.match(/SET\s+VIEW\s+ANGLE\s+([-\d.]+),\s*([-\d.]+)/i);
    if (match) {
        const [, azimuth, elevation] = match.map(parseFloat);
        state.commands.push({ type: 'SET_VIEW', azimuth, elevation, line: lineNumber });
    } else {
        state.addError(lineNumber, 'Invalid SET VIEW syntax.');
    }
}

function parseSetGrid(line: string, state: ParserState, lineNumber: number) {
    const match = line.match(/SET\s+GRID\s+(ON|OFF)/i);
    if (match) {
        state.commands.push({ type: 'SET_GRID', visible: match[1].toUpperCase() === 'ON', line: lineNumber });
    } else {
        state.addError(lineNumber, 'Invalid SET GRID syntax.');
    }
}

function parseSetAxes(line: string, state: ParserState, lineNumber: number) {
    const match = line.match(/SET\s+AXES\s+(ON|OFF)/i);
    if (match) {
        state.commands.push({ type: 'SET_AXES', visible: match[1].toUpperCase() === 'ON', line: lineNumber });
    } else {
        state.addError(lineNumber, 'Invalid SET AXES syntax.');
    }
}

export function parseG3D(script: string): G3D.Scene {
    const state = new ParserState();
    const lines = script.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const originalLineNumber = i + 1;
        let lineContent = lines[i];

        // Clean the line: remove inline comments, then trim
        const commentIndex = lineContent.indexOf(';');
        if (commentIndex !== -1) {
            lineContent = lineContent.substring(0, commentIndex);
        }
        lineContent = lineContent.trim();

        // Strip leading line number
        const lineNumMatch = lineContent.match(/^(\d+)\s+(.*)/);
        if (lineNumMatch) {
            lineContent = lineNumMatch[2].trim();
        }

        // Skip empty lines or full REM comments
        if (!lineContent || lineContent.toUpperCase().startsWith('REM')) continue;

        try {
            const command = lineContent.split(' ')[0].toUpperCase();
            const commandParts = lineContent.split(/\s+/).map(p => p.toUpperCase());

            if (command === 'DEF' || (command.startsWith('FN') && lineContent.includes('='))) {
                parseFunctionDefinition(lineContent, state, originalLineNumber);
            } else if (command === 'PLOT3D') {
                parsePlot3D(lineContent, state, originalLineNumber);
            } else if (command === 'CIRCLE3D') {
                parseCircle3D(lineContent, state, originalLineNumber);
            } else if (command === 'TEXT') {
                parseText(lineContent, state, originalLineNumber);
            } else if (command === 'FOR') {
                const loop = parseFor(lineContent, state, originalLineNumber);
                if (loop) {
                    const bodyLines: { content: string, number: number }[] = [];
                    let nextIndex = -1;
                    for (let j = i + 1; j < lines.length; j++) {
                        let innerLine = lines[j];
                        
                        const innerCommentIndex = innerLine.indexOf(';');
                        if (innerCommentIndex !== -1) {
                            innerLine = innerLine.substring(0, innerCommentIndex);
                        }
                        innerLine = innerLine.trim();

                        const innerLineNumMatch = innerLine.match(/^(\d+)\s+(.*)/);
                        if (innerLineNumMatch) {
                            innerLine = innerLineNumMatch[2].trim();
                        }
                        if (innerLine.toUpperCase().startsWith(`NEXT ${loop.variable}`)) {
                            nextIndex = j;
                            break;
                        }
                        bodyLines.push({ content: innerLine, number: j + 1 });
                    }
                    if (nextIndex !== -1) {
                        evaluateLoop(loop, bodyLines, state);
                        i = nextIndex;
                    } else {
                        state.addError(originalLineNumber, `Missing NEXT ${loop.variable}`);
                    }
                }
            } else if (command === 'SET') {
                if (commandParts.length > 1) {
                    const subCommand = commandParts[1];
                    if (subCommand === 'VIEW') parseSetView(lineContent, state, originalLineNumber);
                    else if (subCommand === 'GRID') parseSetGrid(lineContent, state, originalLineNumber);
                    else if (subCommand === 'AXES') parseSetAxes(lineContent, state, originalLineNumber);
                }
            }
        } catch (e: any) {
            state.addError(originalLineNumber, e.message);
        }
    }
    
    return { commands: state.commands, errors: state.errors.length > 0 ? state.errors : undefined };
}