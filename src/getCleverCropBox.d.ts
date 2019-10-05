export type ImageDimensions = {
  width: number;
  height: number;
};

export type CropOpts = {
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

export type FocalXY = {
  fx: number;
  fy: number;
};
export type FocalArea = {
  r1x: number;
  r1y: number;
  r2x: number;
  r2y: number;
};

export type FocalPointOpts = FocalXY & (FocalArea | {});

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

export type CleverCropTargets = ScalingTarget & CroppingTarget;

// --------------------------------------------------------------------------

export default function getCleverCropBox(
  origSize: ImageDimensions,
  cropInfo: CropOpts,
  focalPoint?: FocalPointOpts
): null | CleverCropTargets;
