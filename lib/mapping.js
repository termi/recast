var assert = require("assert");
var types = require("./types");
var isString = types.builtInTypes.string;
var SourceLocation = types.namedTypes.SourceLocation;
var Position = types.namedTypes.Position;
var linesModule = require("./lines");
var comparePos = require("./util").comparePos;

function Mapping(sourceLines, sourceLoc, targetLoc) {
    assert.ok(this instanceof Mapping);
    assert.ok(sourceLines instanceof linesModule.Lines);
    SourceLocation.assert(sourceLoc);

    if (targetLoc) {
        SourceLocation.assert(targetLoc);
    } else {
        // Assume identity mapping if no targetLoc specified.
        targetLoc = sourceLoc;
    }

    Object.defineProperties(this, {
        sourceLines: { value: sourceLines },
        sourceLoc: { value: sourceLoc },
        targetLoc: { value: targetLoc }
    });
}

var Mp = Mapping.prototype;
module.exports = Mapping;

Mp.slice = function(lines, start, end) {
    assert.ok(lines instanceof linesModule.Lines);
    Position.assert(start);

    if (end) {
        Position.assert(end);
    } else {
        end = lines.lastPos();
    }

    var sourceLines = this.sourceLines;
    var sourceLoc = this.sourceLoc;
    var targetLoc = this.targetLoc;

    function skip(name) {
        var sourceFromPos = sourceLoc[name];
        var targetFromPos = targetLoc[name];
        var targetToPos = start;

        if (name === "end") {
            targetToPos = end;
        } else {
            assert.strictEqual(name, "start");
        }

        return skipChars(
            sourceLines, sourceFromPos,
            lines, targetFromPos, targetToPos
        );
    }

    if (comparePos(start, targetLoc.start) <= 0) {
        if (comparePos(targetLoc.end, end) <= 0) {
            targetLoc = {
                start: subtractPos(targetLoc.start, start.line, start.column),
                end: subtractPos(targetLoc.end, start.line, start.column)
            };

            // The sourceLoc can stay the same because the contents of the
            // targetLoc have not changed.

        } else if (comparePos(end, targetLoc.start) <= 0) {
            return null;

        } else {
            sourceLoc = {
                start: sourceLoc.start,
                end: skip("end")
            };

            targetLoc = {
                start: subtractPos(targetLoc.start, start.line, start.column),
                end: subtractPos(end, start.line, start.column)
            };
        }

    } else {
        if (comparePos(targetLoc.end, start) <= 0) {
            return null;
        }

        if (comparePos(targetLoc.end, end) <= 0) {
            sourceLoc = {
                start: skip("start"),
                end: sourceLoc.end
            };

            targetLoc = {
                // Same as subtractPos(start, start.line, start.column):
                start: { line: 1, column: 0 },
                end: subtractPos(targetLoc.end, start.line, start.column)
            };

        } else {
            sourceLoc = {
                start: skip("start"),
                end: skip("end")
            };

            targetLoc = {
                // Same as subtractPos(start, start.line, start.column):
                start: { line: 1, column: 0 },
                end: subtractPos(end, start.line, start.column)
            };
        }
    }

    return new Mapping(this.sourceLines, sourceLoc, targetLoc);
};

Mp.add = function(line, column) {
    return new Mapping(this.sourceLines, this.sourceLoc, {
        start: addPos(this.targetLoc.start, line, column),
        end: addPos(this.targetLoc.end, line, column)
    });
};

function addPos(toPos, line, column) {
    return {
        line: toPos.line + line - 1,
        column: (toPos.line === 1)
            ? toPos.column + column
            : toPos.column
    };
}

Mp.subtract = function(line, column) {
    return new Mapping(this.sourceLines, this.sourceLoc, {
        start: subtractPos(this.targetLoc.start, line, column),
        end: subtractPos(this.targetLoc.end, line, column)
    });
};

function subtractPos(fromPos, line, column) {
    return {
        line: fromPos.line - line + 1,
        column: (fromPos.line === line)
            ? fromPos.column - column
            : fromPos.column
    };
}

Mp.indent = function(by, skipFirstLine, noNegativeColumns) {
    if (by === 0) {
        return this;
    }

    var targetLoc = this.targetLoc;
    var startLine = targetLoc.start.line;
    var endLine = targetLoc.end.line;

    if (skipFirstLine && startLine === 1 && endLine === 1) {
        return this;
    }

    targetLoc = {
        start: targetLoc.start,
        end: targetLoc.end
    };

    if (!skipFirstLine || startLine > 1) {
        var startColumn = targetLoc.start.column + by;
        targetLoc.start = {
            line: startLine,
            column: noNegativeColumns
                ? Math.max(0, startColumn)
                : startColumn
        };
    }

    if (!skipFirstLine || endLine > 1) {
        var endColumn = targetLoc.end.column + by;
        targetLoc.end = {
            line: endLine,
            column: noNegativeColumns
                ? Math.max(0, endColumn)
                : endColumn
        };
    }

    return new Mapping(this.sourceLines, this.sourceLoc, targetLoc);
};

function skipChars(
    sourceLines, sourceFromPos,
    targetLines, targetFromPos, targetToPos
) {
    assert.ok(sourceLines instanceof linesModule.Lines);
    assert.ok(targetLines instanceof linesModule.Lines);
    Position.assert(sourceFromPos);
    Position.assert(targetFromPos);
    Position.assert(targetToPos);

    var targetComparison = comparePos(targetFromPos, targetToPos);
    if (targetComparison === 0) {
        // Trivial case: no characters to skip.
        return sourceFromPos;
    }

    var sourceCursor = {
        line: sourceFromPos.line,
        column: sourceFromPos.column
    };

    var targetCursor = {
        line: targetFromPos.line,
        column: targetFromPos.column
    };

    if (targetComparison <= 0) {
        // Skipping forward.

        while (comparePos(targetCursor, targetToPos) < 0 &&
               targetLines.firstNonSpacePos(targetCursor, true)) {
            assert.strictEqual(
                sourceLines.firstNonSpacePos(sourceCursor, true),
                sourceCursor
            );

            assert.strictEqual(
                sourceLines.charAt(sourceCursor),
                targetLines.charAt(targetCursor)
            );

            if (comparePos(targetCursor, targetToPos) < 0 &&
                targetLines.nextPos(targetCursor)) {
                assert.ok(sourceLines.nextPos(sourceCursor));
            } else {
                break;
            }
        }

    } else {
        // Skipping backward.

        while (comparePos(targetToPos, targetCursor) < 0 &&
               targetLines.lastNonSpacePos(targetCursor, true)) {
            assert.strictEqual(
                sourceLines.lastNonSpacePos(sourceCursor, true),
                sourceCursor
            );

            assert.strictEqual(
                sourceLines.charAt(sourceCursor),
                targetLines.charAt(targetCursor)
            );

            if (comparePos(targetToPos, targetCursor) < 0 &&
                targetLines.prevPos(targetCursor)) {
                assert.ok(sourceLines.prevPos(sourceCursor));
            } else {
                break;
            }
        }
    }

    return sourceCursor;
}
