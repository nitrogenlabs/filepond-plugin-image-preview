
const createVector = (x, y) => ({x, y});

const vectorDot = (a, b) => (a.x * b.x) + (a.y * b.y);

const vectorSubtract = (a, b) => createVector(a.x - b.x, a.y - b.y);

const vectorDistanceSquared = (a, b) => vectorDot(vectorSubtract(a, b), vectorSubtract(a, b));

const vectorDistance = (a, b) => Math.sqrt(vectorDistanceSquared(a, b));

const getOffsetPointOnEdge = (length, rotation) => {
  const a = length;

  const A = 1.5707963267948966;
  const B = rotation;
  const C = 1.5707963267948966 - rotation;

  const sinA = Math.sin(A);
  const sinB = Math.sin(B);
  const sinC = Math.sin(C);
  const cosC = Math.cos(C);
  const ratio = a / sinA;
  const b = ratio * sinB;
  const c = ratio * sinC;

  return createVector(cosC * b, cosC * c);
};

const getRotatedRectSize = (rect, rotation) => {
  const w = rect.width;
  const h = rect.height;

  const hor = getOffsetPointOnEdge(w, rotation);
  const ver = getOffsetPointOnEdge(h, rotation);

  const tl = createVector(
    rect.x + Math.abs(hor.x),
    rect.y - Math.abs(hor.y)
  );

  const tr = createVector(
    rect.x + rect.width + Math.abs(ver.y),
    rect.y + Math.abs(ver.x)
  );

  const bl = createVector(
    rect.x - Math.abs(ver.y),
    (rect.y + rect.height) - Math.abs(ver.x)
  );

  return {
    width: vectorDistance(tl, tr),
    height: vectorDistance(tl, bl)
  };
};

const calculateCanvasSize = (image, canvasAspectRatio, zoom = 1) => {
  const imageAspectRatio = image.height / image.width;

  // Determine actual pixels on x and y axis
  const canvasWidth = 1;
  const canvasHeight = canvasAspectRatio;
  let imgWidth = 1;
  let imgHeight = imageAspectRatio;
  if(imgHeight > canvasHeight) {
    imgHeight = canvasHeight;
    imgWidth = imgHeight / imageAspectRatio;
  }

  const scalar = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
  const width = image.width / (zoom * scalar * imgWidth);
  const height = width * canvasAspectRatio;

  return {
    width: width,
    height: height
  };
};

export const getImageRectZoomFactor = (imageRect, cropRect, rotation, center) => {
  // Calculate available space round image center position
  const cx = center.x > .5 ? 1 - center.x : center.x;
  const cy = center.y > .5 ? 1 - center.y : center.y;
  const imageWidth = cx * 2 * imageRect.width;
  const imageHeight = cy * 2 * imageRect.height;

  // Calculate rotated crop rectangle size
  const rotatedCropSize = getRotatedRectSize(cropRect, rotation);

  // Calculate scalar required to fit image
  return Math.max(
    rotatedCropSize.width / imageWidth,
    rotatedCropSize.height / imageHeight
  );
};

export const getCenteredCropRect = (container, aspectRatio) => {
  const {height: containerHeight, width: containerWidth} = container;
  let width = containerWidth;
  let height = width * aspectRatio;

  if(height > containerHeight) {
    height = containerHeight;
    width = height / aspectRatio;
  }

  const x = ((container.width - width) * .5);
  const y = ((container.height - height) * .5);

  return {
    x, y, width, height
  };
};

export const getCurrentCropSize = (imageSize, crop: any = {}) => {
  let {zoom, rotation, center, aspectRatio} = crop;

  if(!aspectRatio) {
    aspectRatio = imageSize.height / imageSize.width;
  }

  const canvasSize = calculateCanvasSize(imageSize, aspectRatio, zoom);
  const canvasCenter = {
    x: canvasSize.width * .5,
    y: canvasSize.height * .5
  };

  const stage = {
    x: 0,
    y: 0,
    width: canvasSize.width,
    height: canvasSize.height,
    center: canvasCenter
  };

  const {scaleToFit} = crop;
  const shouldLimit = typeof scaleToFit === 'undefined' || scaleToFit;

  const stageZoomFactor = getImageRectZoomFactor(
    imageSize,
    getCenteredCropRect(stage, aspectRatio),
    rotation,
    shouldLimit ? center : {x: .5, y: .5}
  );

  const scale = zoom * stageZoomFactor;

  // start drawing
  return {
    widthFloat: canvasSize.width / scale,
    heightFloat: canvasSize.height / scale,
    width: Math.round(canvasSize.width / scale),
    height: Math.round(canvasSize.height / scale)
  };
};
