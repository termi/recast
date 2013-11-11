var fromString = require("../lib/lines").fromString;
var Mapping = require("../lib/mapping");

exports.testMapping = function(t, assert) {
    var lines = fromString([
        "function foo(bar) {",
        "  return 1 + bar;",
        "}"
    ].join("\n"));

    var mapping = new Mapping(lines, {
        start: lines.firstPos(),
        end: lines.lastPos()
    });

    assert.deepEqual(
        mapping.sourceLoc,
        mapping.targetLoc
    );

    debugger;
    var sliced = mapping.slice(lines, {
        line: 1,
        column: 9
    });

    console.log(sliced.targetLoc);
    console.log(lines.slice(sliced.targetLoc.start).toString());

    t.finish();
};
