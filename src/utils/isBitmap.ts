export const isBitmap = (file) => /^image/.test(file.type) && !/svg/.test(file.type);
