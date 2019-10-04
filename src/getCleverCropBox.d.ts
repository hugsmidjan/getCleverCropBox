type ImageInfo = {
  width: number;
  height: number;
};

type CropOpts = {
  width?: number;
  height?: number;
  zoom?: number;
  snapTo?: boolean;
} & (
  | {}
  | {
      minRatioX: number;
      minRatioY: number;
      maxRatioX: number;
      maxRatioY: number;
    });

type FocalPointOpts = {
  fx: number;
  fy: number;
} & (
  | {}
  | {
      r1x: number;
      r1y: number;
      r2x: number;
      r2y: number;
    });

// --------------------------------------------------------------------------

type ScalingTarget =
  | {
      doResize: true;
      tooSmall: false;
      scaledWidth: number;
      scaledHeight: number;
    }
  | {
      doResize: false;
      tooSmall: false;
    }
  | {
      doResize: false;
      tooSmall: true;
      targetWidth: number;
      targetHeight: number;
    };

type CroppingTarget =
  | { doCrop: false }
  | {
      doCrop: true;
      cropWidth: number;
      cropHeight: number;
      xPos: number;
      yPos: number;
    };

type CleverCropTargets = ScalingTarget & CroppingTarget;

// --------------------------------------------------------------------------

export default function getCleverCropBox(
  origSize: ImageInfo,
  cropInfo: CropOpts,
  focalPoint?: FocalPointOpts
): null | CleverCropTargets;
