import {fixImageOrientation} from './fixImageOrientation';

// Draws the preview image to canvas
export const createPreviewImage = (data, width: number, height: number, orientation: number) => {
  // Can't draw on half pixels
  let updatedWidth = Math.round(width);
  let updatedHeight = Math.round(height);

  // Draw image
  const canvas = document.createElement('canvas');
  canvas.width = updatedWidth;
  canvas.height = updatedHeight;
  const ctx = canvas.getContext('2d');

  // If is rotated incorrectly swap width and height
  if(orientation >= 5 && orientation <= 8) {
    [updatedWidth, updatedHeight] = [updatedHeight, updatedWidth];
  }

  // Correct image orientation
  fixImageOrientation(ctx, updatedWidth, updatedHeight, orientation);

  // Draw the image
  ctx.drawImage(data, 0, 0, updatedWidth, updatedHeight);

  return canvas;
};
