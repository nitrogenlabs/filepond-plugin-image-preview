export const cloneCanvas = (origin, target?) => {
  const updatedTarget = target || document.createElement('canvas');
  updatedTarget.width = origin.width;
  updatedTarget.height = origin.height;
  const ctx = updatedTarget.getContext('2d');
  ctx.drawImage(origin, 0, 0);
  return updatedTarget;
};
