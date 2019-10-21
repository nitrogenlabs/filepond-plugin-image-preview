export const fitToBounds = (width, height, boundsWidth, boundsHeight) => {
  const resizeFactor = Math.min(boundsWidth / width, boundsHeight / height);

  return {
    height: Math.round(height * resizeFactor),
    width: Math.round(width * resizeFactor)
  };
};
