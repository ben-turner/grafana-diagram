'use strict';

System.register(['lodash'], function (_export, _context) {
  "use strict";

  var _;

  function getColorForValue(data, value) {
    for (var i = data.thresholds.length; i > 0; i--) {
      if (value >= data.thresholds[i - 1]) {
        return data.colorMap[i];
      }
    }
    return _.first(data.colorMap);
  }

  _export('getColorForValue', getColorForValue);

  function getColorByXPercentage(canvas, xPercent) {
    var x = canvas.width * xPercent;
    var context = canvas.getContext('2d');
    var p = context.getImageData(x, 1, 1, 1).data;
    var color = 'rgba(' + p[0] + ', ' + p[1] + ', ' + p[2] + ', ' + p[3] + ')';
    return color;
  }

  _export('getColorByXPercentage', getColorByXPercentage);

  return {
    setters: [function (_lodash) {
      _ = _lodash.default;
    }],
    execute: function () {}
  };
});
//# sourceMappingURL=Color.js.map
