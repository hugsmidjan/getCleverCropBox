import o from 'ospec';
import getCleverCropBox from './getCleverCropBox';

import coreAssertions from './getCleverCropBox-tests-core.json'; // shared between the JS and Java implementations
import extraAssertions from './getCleverCropBox-tests-extra.json'; // JS only - more relaxed inputs, etc.

const assert = ({ name, input, expected }, i) => {
  const { imageSize, cropInfo, focalPoint } = input;
  o(name + ' -- "' + JSON.stringify(input) + '"', () => {
    o(getCleverCropBox(imageSize, cropInfo, focalPoint)).deepEquals(expected);
  });
};

o.spec('getCleverCropBox()', () => {
  coreAssertions.forEach(assert);
  extraAssertions.forEach(assert);
});
