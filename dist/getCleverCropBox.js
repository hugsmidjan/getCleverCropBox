'use strict';

/* global process */


var isNum = function (v) { return typeof v === 'number'; };
var isInt = function (v) { return isNum(v) && Math.round(v) === v; };

// eslint-disable-next-line complexity
var isValid = function (name, o) {
  var ret = false;
  if (name === 'origSize') {
    ret /*true &&*/ =
      isInt(o.width) && o.width > 0 && isInt(o.height) && o.height > 0 && true;
  } else if (name === 'cropInfo') {
    ret /*true &&*/ =
      (o.width || o.height) &&
      (o.width == null || (isInt(o.width) && o.width > 0)) &&
      (o.height == null || (isInt(o.height) && o.height > 0)) &&
      (o.zoom == null || (isInt(o.zoom) && o.zoom >= 100 && o.zoom < 1000)) &&
      //(o.quality==null || (isInt(o.quality) && o.quality>=0 && o.quality<=100))  &&
      // one or none should be defined (We may use ! becuase they're all > 0)
      !!o.minRatioX === !!o.minRatioY &&
      !!o.maxRatioX === !!o.maxRatioY &&
      !!o.minRatioX === !!o.maxRatioX &&
      (o.minRatioX == null || (isNum(o.minRatioX) && o.minRatioX > 0)) &&
      (o.minRatioY == null || (isNum(o.minRatioY) && o.minRatioY > 0)) &&
      (o.maxRatioX == null || (isNum(o.maxRatioX) && o.maxRatioX > 0)) &&
      (o.maxRatioY == null || (isNum(o.maxRatioY) && o.maxRatioY > 0)) &&
      (!o.minRatioX || o.minRatioX / o.minRatioY <= o.maxRatioX / o.maxRatioY) &&
      (o.snapTo == null || typeof o.snapTo === 'boolean') &&
      true;
  } else if (name === 'focalPoint') {
    ret /*true &&*/ =
      isInt(o.fx) &&
      o.fx >= 0 &&
      o.fx <= 100 &&
      isInt(o.fy) &&
      o.fy >= 0 &&
      o.fy <= 100 &&
      // one or none should be defined
      (o.r1x != null) === (o.r1y != null) &&
      (o.r2x != null) === (o.r2y != null) &&
      (o.r1x != null) === (o.r2x != null) &&
      (o.r1x == null || (isInt(o.r1x) && o.r1x >= 0 && o.r1x <= 100)) &&
      (o.r1y == null || (isInt(o.r1y) && o.r1y >= 0 && o.r1y <= 100)) &&
      (o.r2x == null || (isInt(o.r2x) && o.r2x >= 0 && o.r2x <= 100)) &&
      (o.r2y == null || (isInt(o.r2y) && o.r2y >= 0 && o.r2y <= 100)) &&
      (o.r1x == null ||
        (o.fx >= o.r1x && o.fx <= o.r2x && o.fy >= o.r1y && o.fy <= o.r2y)) &&
      true;
  }
  return ret;
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
var getCleverCropBox = function (origSize, cropInfo, focalPoint) {
  var invalid;
  if (
    (!isValid('origSize', origSize) && (invalid = origSize)) ||
    (!isValid('cropInfo', cropInfo) && (invalid = cropInfo)) ||
    (focalPoint && !isValid('focalPoint', focalPoint) && (invalid = focalPoint))
  ) {
    return null;
  }

  var origW = origSize.width; // width of original image
  var origH = origSize.height;
  var scaleToW = cropInfo.width;
  var scaleToH = cropInfo.height;
  var minRatio = cropInfo.minRatioX / cropInfo.minRatioY;
  var maxRatio = cropInfo.maxRatioX / cropInfo.maxRatioY;
  var fP = focalPoint || { fx: 50, fy: 50 };
  var focalX = fP.fx / 100;
  var focalY = fP.fy / 100;
  var zoom = 100 / (cropInfo.zoom || 100);
  var rectangle = !!fP.r1x || fP.r1x === 0; // optional user-defined rectangle (independent of zoom)
  var snapTo = rectangle && cropInfo.snapTo; // snapping depends on a defined rectangle
  var r1x = rectangle && fP.r1x / 100;
  var r1y = rectangle && fP.r1y / 100;
  var r2x = rectangle && fP.r2x / 100;
  var r2y = rectangle && fP.r2y / 100;
  var rectangleW = rectangle && (r2x - r1x) * origW;
  var rectangleH = rectangle && (r2y - r1y) * origH;
  var scaledW; // width of SizeBox or of scaled image before cropping
  var scaledH;
  var xPos; // x position of cropping area
  var yPos;
  var cropW; // width of final CropBox
  var cropH;

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
  var originalAspect = origW / origH;
  var targetAspect =
    maxRatio && originalAspect > maxRatio
      ? maxRatio
      : minRatio && originalAspect < minRatio
      ? minRatio
      : originalAspect;

  // calculate the intended target size for comparison
  var targetWidth;
  var targetHeight;
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
      var rectAspect = rectangleW / rectangleH;
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
  var overshootW = (scaleToW || targetWidth) / cropW;
  var overshootH = (scaleToH || targetHeight) / cropH;

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
      var rezoom =
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
    var recLeft = origW * r1x;
    var recRight = origW * r2x;
    var recTop = origH * r1y;
    var recBottom = origH * r2y;
    var recWidth = recRight - recLeft;
    var recHeight = recBottom - recTop;

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
  var scale = Math.min(scaleToW / cropW || 1, scaleToH / cropH || 1);
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
  var out = {
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

module.exports = getCleverCropBox;
