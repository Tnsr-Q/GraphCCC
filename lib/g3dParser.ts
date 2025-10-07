import { G3D } from '../types';

// Security: whitelist of allowed characters in expressions
const SAFE_EXPRESSION_REGEX = /^[\p{L}\p{N}\s\+\-\*\/\^\(\)\.,_'"\<\>\=\&\|!\?:\/\[\]\u00B2\u00B3\u2070-\u209F]+$/u;

// Security: forbidden keywords to prevent scope access
const FORBIDDEN_KEYWORDS = [
    'window', 'document', 'alert', 'eval', 'function',
    'constructor', 'prototype', '__proto__', 'import', 'export',
    'this', 'self', ';', '{', '}', '=>', '`'
];

// Performance: prevent infinite loops from freezing browser
const MAX_LOOP_ITERATIONS = 10000;
const MAX_SCRIPT_SIZE = 50000;
const MAX_EXPR_LENGTH = 60;

/**
 * Simple string hash function for function body identity
 * Based on Java's String.hashCode() algorithm
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

class ParserState {
    functions: Record<string, Function | number> = {
        SIN: Math.sin, COS: Math.cos, TAN: Math.tan,
        ASIN: Math.asin, ACOS: Math.acos, ATAN: Math.atan,
        SINH: Math.sinh, COSH: Math.cosh, TANH: Math.tanh,
        ABS: Math.abs, SQRT: Math.sqrt, POW: Math.pow,
        EXP: Math.exp, LOG: Math.log, LOG10: Math.log10,
        CEIL: Math.ceil, FLOOR: Math.floor, ROUND: Math.round,
        MIN: Math.min, MAX: Math.max,
        STR: (v: any) => v.toFixed(2),
        INT: Math.trunc,
        PI: Math.PI,
        E: Math.E,
    };
    functionBodies: Record<string, { args: string[], body: string }> = {};
    errors: G3D.G3DError[] = [];
    commands: G3D.AnyCommand[] = [];

    addError(line: number, message: string) {
        this.errors.push({ line, message });
    }
}

function jsifyExpression(expr: string): string {
    return expr.replace(/\^/g, '**').replace(/<>/g, '!=').replace(/=/g, '==').replace(/AND/ig, '&&').replace(/OR/ig, '||');
}

function securelyEvaluate(expr: string, context: Record<string, any>): any {
    // 1. Basic character validation
    if (!SAFE_EXPRESSION_REGEX.test(expr)) {
        throw new Error(`Expression contains invalid characters.`);
    }

    // 2. Forbidden keyword check
    const lowerExpr = expr.toLowerCase();
    for (const keyword of FORBIDDEN_KEYWORDS) {
        if (lowerExpr.includes(keyword)) {
            throw new Error(`Expression contains forbidden keyword: ${keyword}`);
        }
    }

    // 3. Prepare context and sanitized expression
    const contextNames = Object.keys(context);
    const contextValues = Object.values(context);
    const jsExpr = jsifyExpression(expr);
    
    // 4. Execute in a controlled environment
    try {
        const evaluator = new Function(...contextNames, `return ${jsExpr}`);
        const result = evaluator(...contextValues);
        if (typeof result === 'number' && !isFinite(result)) {
            return 0;
        }
        return result;
    } catch (e: any) {
        // Better error messages with truncation
        let message = e.message;
        const match = message.match(/(\w+)\s+is not defined/);
        if (match) {
            message = `${match[1]} is not defined`;
        }
        const displayExpr = expr.length > MAX_EXPR_LENGTH 
            ? expr.substring(0, MAX_EXPR_LENGTH) + '...' 
            : expr;
        throw new Error(`Failed to evaluate: "${displayExpr}" - ${message}`);
    }
}


function parseFunctionDefinition(line: string, state: ParserState, lineNumber: number) {
    const simpleDefMatch = line.match(/DEF\s+(FN[A-Z0-9]+)\((.*?)\)\s*=\s*(.*)/i);
    const continuationMatch = line.match(/(FN[A-Z0-9]+)\s*=\s*\1\s*\+\s*(.*)/i);
    
    let funcName: string, args: string[], body: string;

    if (simpleDefMatch) {
        funcName = simpleDefMatch[1].toUpperCase();
        args = simpleDefMatch[2].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
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
        const allFuncs = state.functions;
        const func = (...argValues: number[]) => {
            const scope = args.reduce((acc, argName, index) => {
                acc[argName] = argValues[index];
                return acc;
            }, {} as Record<string, number>);
            return securelyEvaluate(body, { ...allFuncs, ...scope });
        };
        state.functions[funcName] = func;
    } catch (e: any) {
        state.addError(lineNumber, `Invalid function body for ${funcName}: ${e.message}`);
    }
}

function parsePlot3D(line: string, state: ParserState, lineNumber: number) {
    const match = line.match(/PLOT3D\s+(FN[A-Z0-9]+)\(X,Y\)/i);
    if (match) {
        const funcName = match[1].toUpperCase();
        const func = state.functions[funcName];
        const funcBody = state.functionBodies[funcName];
        
        if (typeof func === 'function' && funcBody) {
            // Hash the function body for stable identity
            const funcHash = hashString(funcBody.body);
            
            // Check if function uses 'n' parameter
            const usesN = /\bn\b/i.test(funcBody.body);
            
            state.commands.push({
                type: 'PLOT3D',
                func: (x: number, y: number, n: number) => {
                    // Add 'n' to the evaluation context
                    const result = usesN 
                        ? securelyEvaluate(funcBody.body, { ...state.functions, X: x, Y: y, N: n })
                        : func(x, y);
                    return typeof result === 'number' && isFinite(result) ? result : 0;
                },
                funcHash,
                usesN,
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

function parseText(line: string, state: ParserState, lineNumber: number, scope: Record<string, any> = {}) {
    const match = line.match(/(?:TEXT|LABEL)\s+AT\s+(.*?)\s+(?:TEXT)?\s*"(.*)"/i);
    if (match) {
        const [, posStr, textExpr] = match;
        const posParts = posStr.split(',').map(s => s.trim());
        if (posParts.length !== 3) {
            state.addError(lineNumber, 'TEXT/LABEL AT requires 3 coordinates.');
            return;
        }
        try {
            const x = securelyEvaluate(posParts[0], { ...state.functions, ...scope });
            const y = securelyEvaluate(posParts[1], { ...state.functions, ...scope });
            const z = securelyEvaluate(posParts[2], { ...state.functions, ...scope });
            const text = securelyEvaluate(`"${textExpr}"`, { ...state.functions, ...scope });

            state.commands.push({
                type: 'TEXT',
                position: { x, y, z },
                text: String(text),
                line: lineNumber,
            });
        } catch (e: any) {
            state.addError(lineNumber, e.message);
        }
    } else {
        state.addError(lineNumber, 'Invalid TEXT/LABEL AT syntax.');
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
            const context = { ...state.functions, ...scope };
            const x = securelyEvaluate(posParts[0], context);
            const y = securelyEvaluate(posParts[1], context);
            const z = securelyEvaluate(posParts[2], context);

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
    const match = line.match(/FOR\s+(\w+)\s*=\s*([-\d.eE]+)\s+TO\s+([-\d.eE]+)\s+STEP\s+([-\d.eE]+)/i);
    if (match) {
        const [, variable, start, end, step] = match;
        return { variable: variable.toUpperCase(), start: parseFloat(start), end: parseFloat(end), step: parseFloat(step) };
    }
    state.addError(lineNumber, 'Invalid FOR loop syntax.');
    return null;
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

function processLine(line: string, lineNumber: number, state: ParserState, scope: Record<string, any> = {}) {
     const command = line.split(' ')[0].toUpperCase();
     const commandParts = line.split(/\s+/).map(p => p.toUpperCase());

    if (command === 'DEF' || (command.startsWith('FN') && line.includes('='))) {
        parseFunctionDefinition(line, state, lineNumber);
    } else if (command === 'PLOT3D') {
        parsePlot3D(line, state, lineNumber);
    } else if (command === 'CIRCLE3D') {
        parseCircle3D(line, state, lineNumber);
    } else if (command === 'TEXT' || command === 'LABEL') {
        parseText(line, state, lineNumber, scope);
    } else if (command === 'PLOT') {
        if (commandParts[1] === 'POINT3D') parsePlotPoint3D(line, state, lineNumber, scope);
    } else if (command.toUpperCase() === 'G_VALUE') {
        const match = line.match(/G_VALUE\s*=\s*(.*)/i);
        if(match) {
            try {
                securelyEvaluate(match[1], { ...state.functions, ...scope });
            } catch (e: any) {
                state.addError(lineNumber, e.message);
            }
        }
    }
}

export function parseG3D(script: string): G3D.Scene {
    if (script.length > MAX_SCRIPT_SIZE) {
        return { commands: [], errors: [{ line: 1, message: `Script too large. Maximum size is ${MAX_SCRIPT_SIZE} characters.` }] };
    }
    const state = new ParserState();
    const lines = script.split('\n').map((content, index) => ({ content, number: index + 1 }));

    for (let i = 0; i < lines.length; i++) {
        const { content: originalLine, number: originalLineNumber } = lines[i];

        let line = originalLine.split(';')[0].trim();
        line = line.replace(/^(\d+)\s+/, '');

        if (!line || line.toUpperCase().startsWith('REM')) continue;
        
        try {
            const command = line.split(' ')[0].toUpperCase();
            if (command === 'FOR') {
                const loop = parseFor(line, state, originalLineNumber);
                if (loop) {
                    const bodyLines: { content: string, number: number }[] = [];
                    let nextIndex = -1;
                    for (let j = i + 1; j < lines.length; j++) {
                        let innerLine = lines[j].content.split(';')[0].trim();
                        innerLine = innerLine.replace(/^(\d+)\s+/, '');
                        if (innerLine.toUpperCase() === `NEXT ${loop.variable}`) {
                            nextIndex = j;
                            break;
                        }
                        bodyLines.push({ content: innerLine, number: lines[j].number });
                    }
                    if (nextIndex !== -1) {
                        // CRITICAL: Loop iteration limit to prevent DOS
                        let iterations = 0;
                        for (let val = loop.start; val <= loop.end; val += loop.step) {
                            if (++iterations > MAX_LOOP_ITERATIONS) {
                                state.addError(originalLineNumber, 
                                    `FOR loop exceeded ${MAX_LOOP_ITERATIONS} iterations. ` +
                                    `Current: ${loop.variable}=${val.toFixed(4)}, ` +
                                    `Range: ${loop.start} to ${loop.end}, Step: ${loop.step}`
                                );
                                break;
                            }
                            const loopScope = { [loop.variable]: val };
                            for (const bodyLine of bodyLines) {
                                if (bodyLine.content) {
                                    processLine(bodyLine.content, bodyLine.number, state, loopScope);
                                }
                            }
                        }
                        i = nextIndex;
                    } else {
                        state.addError(originalLineNumber, `Missing NEXT ${loop.variable}`);
                    }
                }
            } else if (command === 'SET') {
                const subCommand = line.split(/\s+/)[1]?.toUpperCase();
                if (subCommand === 'VIEW') parseSetView(line, state, originalLineNumber);
                else if (subCommand === 'GRID') parseSetGrid(line, state, originalLineNumber);
                else if (subCommand === 'AXES') parseSetAxes(line, state, originalLineNumber);
            }
            else {
                processLine(line, originalLineNumber, state);
            }

        } catch (e: any) {
            state.addError(originalLineNumber, e.message);
        }
    }
    
    return { commands: state.commands, errors: state.errors.length > 0 ? state.errors : undefined };
}