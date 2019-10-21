export const getMarkupValue = (value: any, size, scalar: number = 1, axis?: string): number => {
  if(typeof value === 'string') {
    return parseFloat(value) * scalar;
  }

  if(typeof value === 'number') {
    return value * (axis ? size[axis] : Math.min(size.width, size.height));
  }

  return 0;
};
