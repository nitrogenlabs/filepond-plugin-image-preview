
const MAX_WIDTH = 10;
const MAX_HEIGHT = 10;

const averageColor = (c, l) => Math.floor(Math.sqrt(c / (l / 4)));

export const calculateAverageColor = (image) => {
  const scalar = Math.min(MAX_WIDTH / image.width, MAX_HEIGHT / image.height);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const width = Math.ceil(image.width * scalar);
  const height = Math.ceil(image.height * scalar);
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
  let data = null;

  try {
    const {data: imageData} = ctx.getImageData(0, 0, width, height);
    data = imageData;
  } catch(e) {
    return null;
  }
  const l = data.length;

  let r = 0;
  let g = 0;
  let b = 0;
  let i = 0;

  for(; i < l; i += 4) {
    r += data[i] * data[i];
    g += data[i + 1] * data[i + 1];
    b += data[i + 2] * data[i + 2];
  }

  r = averageColor(r, l);
  g = averageColor(g, l);
  b = averageColor(b, l);

  return {r, g, b};
};
