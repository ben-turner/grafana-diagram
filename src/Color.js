import _ from 'lodash';

export function getColorForValue(data, value) {
  for (let i = data.thresholds.length; i > 0; i--) {
    if (value >= data.thresholds[i - 1]) {
      return data.colorMap[i];
    }
  }
  return _.first(data.colorMap);
}

export function getColorByXPercentage(canvas, xPercent) {
  const x = canvas.width * xPercent;
  const context = canvas.getContext('2d');
  const p = context.getImageData(x, 1, 1, 1).data;
  const color = `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${p[3]})`;
  return color;
}

