/**
 * Bitmap Worker
 */
export const BitmapWorker = function() {
  self.onmessage = (event) => {
    const {data: {id, message: {file}}} = event;

    createImageBitmap(file).then((bitmap) => {
      self.postMessage({id, message: bitmap}, [bitmap] as any);
    });
  };
};
