/* global process */
const isDev = process.env.NODE_ENV === 'development';

const isNum = (v) => typeof v === 'number';
const isNumOrNull = (v) => v == null || typeof v === 'number';
// const isNullOrBool = (v) => v == null || typeof v === 'number';

// NOTE: we don't really care about integer checking
const isInt = isNum; // (v) => isNum(v) && Math.round(v) === v;
const isIntOrNull = isNumOrNull; // (v) => v == null || isInt(v);

const logInvalid = isDev
  ? (name, object) =>
      console.error('Invalid getCleverCropBox() input `' + name + '`', object)
  : () => {};

// NOTE: `isValidTypes()` is not really needed for applications written in TypeScript.
// eslint-disable-next-line complexity
const isValidTypes = (o, c, f) => {
  let valid = true;
  if (!(isInt(o.width) && isInt(o.height))) {
    valid = false;
    isDev && logInvalid('origSize (type)', o);
  }
  if (
    !(
      isIntOrNull(c.width) &&
      isIntOrNull(c.height) &&
      isNumOrNull(c.zoom) &&
      // all or none should be defined
      ((!c.minRatioX && !c.minRatioY && !c.maxRatioX && !c.maxRatioY) ||
        (isNum(c.minRatioX) &&
          isNum(c.minRatioY) &&
          isNum(c.maxRatioX) &&
          isNum(c.maxRatioY)))
    )
  ) {
    valid = false;
    isDev && logInvalid('cropInfo (type)', c);
  }
  if (
    f &&
    !(
      isNum(f.fx) &&
      isNum(f.fy) &&
      // all or none should be defined
      ((!f.r1x && !f.r1y && !f.r2x && !f.r2y) ||
        (isNum(f.r1x) && isNum(f.r1y) && isNum(f.r2x) && isNum(f.r2y)))
    )
  ) {
    valid = false;
    isDev && logInvalid('focalPoint (type)', f);
  }
  return valid;
};

// eslint-disable-next-line complexity
const isValidValues = (o, c, f) => {
  let valid = true;
  if (!(o.width > 0 && o.height > 0)) {
    valid = false;
    isDev && logInvalid('origSize', o);
  }
  if (
    !(
      (c.width || c.height) &&
      (c.width == null || c.width > 0) &&
      (c.height == null || c.height > 0) &&
      (c.zoom == null || (c.zoom >= 100 && c.zoom < 1000)) &&
      //(c.quality==null || (isNum(c.quality) && c.quality>=0 && c.quality<=100))  &&
      // all or none are defined
      (!c.minRatioX || // NOTE: We may use ! becuase they're all > 0
        (c.minRatioX > 0 &&
          c.minRatioY > 0 &&
          c.maxRatioX > 0 &&
          c.maxRatioY > 0 &&
          // minRatio is smaller than maxRatio
          c.minRatioX / c.minRatioY <= c.maxRatioX / c.maxRatioY))
    )
  ) {
    valid = false;
    isDev && logInvalid('cropInfo', c);
  }

  if (
    f &&
    !(
      f.fx >= 0 &&
      f.fx <= 100 &&
      f.fy >= 0 &&
      f.fy <= 100 &&
      // all or none are defined
      (f.r1x == null ||
        (f.r1x >= 0 &&
          f.r1x <= 100 &&
          f.r1y >= 0 &&
          f.r1y <= 100 &&
          f.r2x >= 0 &&
          f.r2x <= 100 &&
          f.r2y >= 0 &&
          f.r2y <= 100 &&
          // Focus point is within the focus rectangle
          (f.fx >= f.r1x && f.fx <= f.r2x && f.fy >= f.r1y && f.fy <= f.r2y)))
    )
  ) {
    valid = false;
    isDev && logInvalid('focalPoint', f);
  }
  return valid;
};

// ***************************************
//  The juicy stuff:
//  * Takes two objects, an optional array and an optional boolean (NEW!)
//  * Returns a key-value object
/**
 *
 * @param origSize
 * @param cropInfo
 * @param focalPoint
 * @return {Object}
 * <pre>
 * {
 *   doCrop: boolean,
 *     cropWidth = int,
 *     cropHeight = int,
 *     xPos = int,
 *     yPos = int,
 *   doResize: boolean,
 *     scaledWidth = int;
 *     scaledHeight = int;
 *   tooSmall: boolean,
 *     targetWidth = int,
 *     targetHeight = int
 * }
 * </pre>
 */

// eslint-disable-next-line complexity
const getCleverCropBox = (origSize, cropInfo, focalPoint) => {
  if (
    !isValidTypes(origSize, cropInfo, focalPoint) ||
    !isValidValues(origSize, cropInfo, focalPoint)
  ) {
    return null;
  }

  const origW = origSize.width; // width of original image
  const origH = origSize.height;
  let scaleToW = cropInfo.width;
  let scaleToH = cropInfo.height;
  const minRatio = cropInfo.minRatioX / cropInfo.minRatioY;
  const maxRatio = cropInfo.maxRatioX / cropInfo.maxRatioY;
  const fP = focalPoint || { fx: 50, fy: 50 };
  const focalX = fP.fx / 100;
  const focalY = fP.fy / 100;
  let zoom = 100 / (cropInfo.zoom || 100);
  const rectangle = !!fP.r1x || fP.r1x === 0; // optional user-defined rectangle (independent of zoom)
  const snapTo = rectangle && cropInfo.snapTo; // snapping depends on a defined rectangle
  const r1x = rectangle && fP.r1x / 100;
  const r1y = rectangle && fP.r1y / 100;
  const r2x = rectangle && fP.r2x / 100;
  const r2y = rectangle && fP.r2y / 100;
  const rectangleW = rectangle && (r2x - r1x) * origW;
  const rectangleH = rectangle && (r2y - r1y) * origH;
  let scaledW; // width of SizeBox or of scaled image before cropping
  let scaledH;
  let xPos; // x position of cropping area
  let yPos;
  let cropW; // width of final CropBox
  let cropH;

  // Rules of the game:
  //   1) images are never scaled up.
  //   2) scaleToW/scaleToH defines a bounding-box inside which the final image should fit.
  //   3) cropping is limited (capped) by original image size
  //   4) zooming is limited (capped) by original image size
  //   5) crop area proportionally follows focalPoint
  //   6) crop area shifts to try containing a focalArea-rectangle
  //      6a) when shifting, ratio and size of crop area stay constant
  //      6b) crop area may not shift in a way that does not contain focalPoint
  //   7) focalArea-rectangle + snapTo enforce zoom-behaviour and override any zoom levels
  //   8) focalArea-rectangle (without snapTo) limits how much zooming is allowed
  //   9) snapTo zooming is limited by original image-size & scaleToW/scaleToH

  // find the bounding-box for the final scaling operation
  // (Rule 1: images are never scaled up)
  // default to 0 for undefined dimensions - to prevent cropping ever to be limited (capped) in that dimension.

  // Rules in order of importance:
  //  1) Never do upscaling of the original image (we don't do that ever!)
  //  2) Minimize Rattling (returned image smaller than ideal/desired target width/height)
  //  3) Avoid incorrect aspect ratio
  //  4) Include the focalPoint
  //  5) Include as much of focalArea as possible (cop elegantly off top/bottom or left/right edges proportional to focalPoint's placement within focalArea)
  //  6) Shift crop area (proportionally) relative to focalPoint
  //  7) Respect snapTo rule
  //  8) Respect zoom level

  scaleToW = scaleToW ? Math.min(scaleToW, origW) : 0;
  scaleToH = scaleToH ? Math.min(scaleToH, origH) : 0;

  // find desired aspect ratio
  const originalAspect = origW / origH;
  const targetAspect =
    maxRatio && originalAspect > maxRatio
      ? maxRatio
      : minRatio && originalAspect < minRatio
      ? minRatio
      : originalAspect;

  // calculate the intended target size for comparison
  let targetWidth;
  let targetHeight;
  if (cropInfo.width) {
    if (cropInfo.height) {
      targetWidth = Math.min(cropInfo.width, cropInfo.height * targetAspect);
    } else {
      targetWidth = cropInfo.width;
    }
    targetHeight = targetWidth / targetAspect;
  } else {
    // then cropInfo.height must be set
    targetHeight = cropInfo.height;
    targetWidth = targetHeight * targetAspect;
  }

  // find inital crop dimensions (w/o zooming)
  cropW = Math.min(origW, origH * targetAspect);
  cropH = Math.min(origH, origW / targetAspect);

  if (snapTo) {
    zoom = Math.min(1, Math.max(rectangleW / cropW, rectangleH / cropH));
  } else if (zoom < 1 && rectangle) {
    if (rectangleW > cropW * zoom || rectangleH > cropH * zoom) {
      // a rectangle is defined, larger than the crop. Let's try to contain it while retaining aspect ratio
      const rectAspect = rectangleW / rectangleH;
      if (rectAspect < targetAspect) {
        // aiming for rectangleH, as long as we don't rattle (zoom past 1)
        zoom = Math.min(rectangleH / cropH, 1); // we'll need all of the width available in original
      } else {
        // aim for rectW
        zoom = Math.min(rectangleW / cropW, 1); // we'll need all of the width available in original
      }
    }
  }

  // apply zoom to the crop dimensions
  // (but make sure a snapTo-rectangle hasn't extended crop dimensions beyond image borders);
  cropW = Math.min(cropW * zoom, origW);
  cropH = Math.min(cropH * zoom, origH);

  // correct/cap crop dimensions
  // if both non-zero bounding-box dimensions overshot ( i.e. crop-area rattles inside bounding-box)
  let overshootW = (scaleToW || targetWidth) / cropW;
  let overshootH = (scaleToH || targetHeight) / cropH;

  overshootW = overshootW > 1 ? overshootW : 0;
  overshootH = overshootH > 1 ? overshootH : 0;

  if (overshootW || overshootH) {
    if (zoom === 1) {
      // <-- no zoom
      // (NOTE: at least one of the crop dimensions is guaranteed to be equal to original image size)
      cropW = Math.max(cropW, Math.min(targetWidth, scaleToW || origW));
      cropH = Math.max(cropH, Math.min(targetHeight, scaleToH || origH));
    } // if ( zoom < 1 )
    else {
      // Cap zoom at a level where at least one crop dimension fits snugly inside bounding-box
      // (id would be silly to zoom so far in that we end up with too small a crop area)
      const rezoom =
        !(overshootW && overshootH) || (targetWidth > scaleToW || targetHeight > scaleToH)
          ? Math.max(overshootW, overshootH)
          : Math.min(overshootW, overshootH);

      // if we had to decrease the original zoom level (zoom back out)
      // make sure crop stays inside original image borders.
      if (targetWidth > cropW) {
        cropW = Math.min(cropW * rezoom, origW, targetWidth);
      }

      if (targetHeight > cropH) {
        cropH = Math.min(cropH * rezoom, origH, targetHeight);
      }
    }
  }

  // find desired crop-box offset based on focal coordinates
  xPos = (origW - cropW) * focalX;
  yPos = (origH - cropH) * focalY;
  if (rectangle) {
    // attempt to cover as much as possible of the defined rectangle by crop area
    const recLeft = origW * r1x;
    const recRight = origW * r2x;
    const recTop = origH * r1y;
    const recBottom = origH * r2y;
    const recWidth = recRight - recLeft;
    const recHeight = recBottom - recTop;

    if (recWidth > cropW) {
      // focalArea is wider than the crop
      // x-position cropping area proptional to focalPoint's x-position within focalArea
      xPos = recLeft + ((focalX - r1x) / (r2x - r1x)) * (recWidth - cropW);
    } else {
      // focalArea can be contained within the crop
      // if needed, shift cropArea horizontally to contain focalArea
      xPos = recLeft < xPos ? recLeft : recRight > xPos + cropW ? recRight - cropW : xPos;
    }

    if (recHeight > cropH) {
      // focalArea is wider than the crop
      // x-position cropping area proptional to focalPoint's x-position within focalArea
      yPos = recTop + ((focalY - r1y) / (r2y - r1y)) * (recHeight - cropH);
    } else {
      // focalArea can be contained within the crop
      // if needed, shift cropArea horizontally to contain focalArea
      yPos = recTop < yPos ? recTop : recBottom > yPos + cropH ? recBottom - cropH : yPos;
    }
  }

  // choose proportional scaling-factor for final image.
  const scale = Math.min(scaleToW / cropW || 1, scaleToH / cropH || 1);
  // calculate the final cropped image dimensions
  scaledW = scale * cropW;
  scaledH = scale * cropH;

  // final rounding
  scaledW = Math.round(scaledW);
  scaledH = Math.round(scaledH);
  cropW = Math.round(cropW);
  cropH = Math.round(cropH);
  xPos = Math.round(xPos);
  yPos = Math.round(yPos);
  targetWidth = Math.round(targetWidth);
  targetHeight = Math.round(targetHeight);

  // prepare output object
  const out = {
    doCrop: cropW !== origW || cropH !== origH,
    doResize: scaledW !== cropW && scaledH !== cropH,
    tooSmall: origW < targetWidth || origH < targetHeight,
  };

  if (out.doResize) {
    out.scaledWidth = scaledW;
    out.scaledHeight = scaledH;
  }
  if (out.doCrop) {
    out.cropWidth = cropW;
    out.cropHeight = cropH;
    out.xPos = xPos;
    out.yPos = yPos;
  }
  if (out.tooSmall) {
    out.targetWidth = targetWidth;
    out.targetHeight = targetHeight;
  }

  return out;
};

export default getCleverCropBox;
