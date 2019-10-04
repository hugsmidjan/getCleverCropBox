import o  from 'ospec';
import getCleverCropBox from './getCleverCropBox';

import assertions from './getCleverCropBox-tests.json';

o.spec('getCleverCropBox()', () => {
  assertions.forEach(({ name, input, expected }, i) => {
		const { imageSize, cropInfo, focalPoint } = input;
    o(name + ' -- "' + JSON.stringify(input) + '"', () => {
      o(getCleverCropBox(imageSize, cropInfo, focalPoint)).deepEquals(expected);
    });
  });
});
