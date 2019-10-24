import {BitmapWorker} from '../utils/BitmapWorker';
import {calculateAverageColor} from '../utils/calculateAverageColor';
import {cloneCanvas} from '../utils/cloneCanvas';
import {cloneImageData} from '../utils/cloneImageData';
import {ColorMatrixWorker} from '../utils/ColorMatrixWorker';
import {createPreviewImage} from '../utils/createPreviewImage';
import {getImageSize} from '../utils/getImageSize';
import {isBitmap} from '../utils/isBitmap';
import {createImageOverlayView} from './createImageOverlayView';
import {createImageView} from './createImageView';

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.onload = () => {
    resolve(img);
  };
  img.onerror = (e) => {
    reject(e);
  };
  img.src = url;
});

export const createImageWrapperView = (imageWrapper) => {
  // Create overlay view
  const OverlayView = createImageOverlayView(imageWrapper);
  const ImageView = createImageView(imageWrapper);
  const {createWorker} = imageWrapper.utils;

  const applyFilter = (root, filter, target) => new Promise((resolve) => {
    // Will store image data for future filter updates
    if(!root.ref.imageData) {
      root.ref.imageData = target.getContext('2d').getImageData(0, 0, target.width, target.height);
    }

    // Get image data reference
    const imageData = cloneImageData(root.ref.imageData);

    if(!filter || filter.length !== 20) {
      target.getContext('2d').putImageData(imageData, 0, 0);
      return resolve();
    }

    const worker = createWorker(ColorMatrixWorker);
    worker.post(
      {colorMatrix: filter, imageData},
      (response) => {
        // Apply filtered colors
        target.getContext('2d').putImageData(response, 0, 0);

        // Stop worker
        worker.terminate();

        // Done!
        resolve();
      },
      [imageData.data.buffer]
    );
  });

  const removeImageView = (root, imageView) => {
    root.removeChildView(imageView);
    imageView.image.width = 1;
    imageView.image.height = 1;
    imageView._destroy();
  };

  // Remove an image
  const shiftImage = ({root}) => {
    const imageView = root.ref.images.shift();
    imageView.opacity = 0;
    imageView.translateY = 0;
    root.ref.imageViewBin.push(imageView);
    return imageView;
  };

  // Add new image
  const pushImage = ({root, props, image}) => {
    const {id} = props;
    const item = root.query('GET_ITEM', {id});

    if(!item) {
      return null;
    }

    const crop = item.getMetadata('crop') || {
      aspectRatio: null,
      center: {
        x: .5,
        y: .5
      },
      flip: {
        horizontal: false,
        vertical: false
      },
      rotation: 0,
      zoom: 1
    };

    const background = root.query('GET_IMAGE_TRANSFORM_CANVAS_BACKGROUND_COLOR');
    let markup;
    let resize;
    let dirty = false;

    if(root.query('GET_IMAGE_PREVIEW_MARKUP_SHOW')) {
      markup = item.getMetadata('markup') || [];
      resize = item.getMetadata('resize');
      dirty = true;
    }

    // Append image presenter
    const imageView = root.appendChildView(
      root.createChildView(ImageView, {
        background,
        crop,
        dirty,
        id,
        image,
        markup,
        opacity: 0,
        resize,
        scaleX: 1.05,
        scaleY: 1.05,
        translateY: 0
      }),
      root.childViews.length
    );
    root.ref.images.push(imageView);

    // Reveal the preview image
    imageView.opacity = 1;
    imageView.scaleX = 1;
    imageView.scaleY = 1;
    imageView.translateY = 0;

    // The preview is now ready to be drawn
    setTimeout(() => root.dispatch('DID_IMAGE_PREVIEW_SHOW', {id}), 250);

    return null;
  };

  const updateImage = ({root, props}) => {
    const item = root.query('GET_ITEM', {id: props.id});

    if(!item) {
      return null;
    }

    const imageView = root.ref.images[root.ref.images.length - 1];
    imageView.crop = item.getMetadata('crop');
    imageView.background = root.query('GET_IMAGE_TRANSFORM_CANVAS_BACKGROUND_COLOR');

    if(root.query('GET_IMAGE_PREVIEW_MARKUP_SHOW')) {
      imageView.dirty = true;
      imageView.resize = item.getMetadata('resize');
      imageView.markup = item.getMetadata('markup');
    }

    return null;
  };

  // replace image preview
  const didUpdateItemMetadata = ({root, props, action}) => {
    // Only filter and crop trigger redraw
    if(!/crop|filter|markup|resize/.test(action.change.key)) {
      return null;
    }

    // No images to update, exit
    if(!root.ref.images.length) {
      return null;
    }

    // No item found, exit
    const item = root.query('GET_ITEM', {id: props.id});
    if(!item) {
      return null;
    }

    // For now, update existing image when filtering
    if(/filter/.test(action.change.key)) {
      const imageView = root.ref.images[root.ref.images.length - 1];
      applyFilter(root, action.change.value, imageView.image);
      return null;
    }

    if(/crop|markup|resize/.test(action.change.key)) {
      const crop = item.getMetadata('crop');
      const image = root.ref.images[root.ref.images.length - 1];

      // if aspect ratio has changed, we need to create a new image
      if(Math.abs(crop.aspectRatio - image.crop.aspectRatio) > .00001) {
        const imageView = shiftImage({root});
        pushImage({image: cloneCanvas(imageView.image), props, root});
      } else {
        // If not, we can update the current image
        updateImage({props, root});
      }
    }

    return null;
  };

  const canCreateImageBitmap = (file) => 'createImageBitmap' in window && isBitmap(file);

  /**
   * Write handler for when preview container has been created
   */
  const didCreatePreviewContainer = ({root, props}) => {
    const {id} = props;

    // We need to get the file data to determine the eventual image size
    const item = root.query('GET_ITEM', id);

    if(!item) {
      return null;
    }

    // Get url to file (we'll revoke it later on when done)
    const fileURL = URL.createObjectURL(item.file);

    // Determine image size of this item
    getImageSize(fileURL, (width, height) => {
      // We can now scale the panel to the final size
      root.dispatch('DID_IMAGE_PREVIEW_CALCULATE_SIZE', {
        height,
        id,
        width
      });
    });
  };

  const drawPreview = ({root, props}) => {
    const {id} = props;

    // We need to get the file data to determine the eventual image size
    const item = root.query('GET_ITEM', id);

    if(!item) {
      return null;
    }

    // Get url to file (we'll revoke it later on when done)
    const fileURL = URL.createObjectURL(item.file);

    // Image is now ready
    const previewImageLoaded = (imageData) => {
      // the file url is no longer needed
      URL.revokeObjectURL(fileURL);

      // Draw the scaled down version here and use that as source so bitmapdata can be closed
      // orientation info
      const exif = item.getMetadata('exif') || {};
      const orientation: number = exif.orientation || -1;

      // get width and height from action, and swap if orientation is incorrect
      let {width, height} = imageData;

      if(orientation >= 5 && orientation <= 8) {
        [width, height] = [height, width];
      }

      // Scale canvas based on pixel density
      // We multiply by .75 as that creates smaller but still clear images on screens with high res displays
      const pixelDensityFactor: number = Math.max(1, window.devicePixelRatio * .75);

      // We want as much pixels to work with as possible,
      // this multiplies the minimum image resolution,
      // so when zooming in it doesn't get too blurry
      const zoomFactor: number = root.query('GET_IMAGE_PREVIEW_ZOOM_FACTOR');

      // Image scale factor
      const scaleFactor: number = zoomFactor * pixelDensityFactor;

      // Calculate scaled preview image size
      const previewImageRatio: number = height / width;

      // Calculate image preview height and width
      const previewContainerWidth: number = root.rect.element.width;
      const previewContainerHeight: number = root.rect.element.height;

      let imageWidth: number = previewContainerWidth;
      let imageHeight: number = imageWidth * previewImageRatio;

      if(previewImageRatio > 1) {
        imageWidth = Math.min(width, previewContainerWidth * scaleFactor);
        imageHeight = imageWidth * previewImageRatio;
      } else {
        imageHeight = Math.min(height, previewContainerHeight * scaleFactor);
        imageWidth = imageHeight / previewImageRatio;
      }

      // Transfer to image tag so no canvas memory wasted on iOS
      const previewImage = createPreviewImage(imageData, imageWidth, imageHeight, orientation);

      // Done
      const done = (data) => {
        // Calculate average image color, disabled for now
        const averageColor = root.query('GET_IMAGE_PREVIEW_CALCULATE_AVERAGE_IMAGE_COLOR')
          ? calculateAverageColor(data)
          : null;
        item.setMetadata('color', averageColor, true);

        // Data has been transferred to canvas ( if was ImageBitmap )
        if('close' in imageData) {
          imageData.close();
        }

        // Show the overlay
        root.ref.overlayShadow.opacity = 1;

        // Create the first image
        pushImage({image: previewImage, props, root});
      };

      // Apply filter
      const filter = item.getMetadata('filter');
      if(filter) {
        applyFilter(root, filter, previewImage).then(done);
      } else {
        done(imageData);
      }
    };

    // Fallback
    const loadPreviewFallback = () => {
      // Let's scale the image in the main thread :(
      loadImage(fileURL).then(previewImageLoaded);
    };

    // If we support scaling using createImageBitmap we use a worker
    if(canCreateImageBitmap(item.file)) {
      // Let's scale the image in a worker
      const worker = createWorker(BitmapWorker);

      worker.post(
        {file: item.file},
        (imageBitmap) => {
          // Destroy worker
          worker.terminate();

          // No bitmap returned, must be something wrong,
          // Try the oldschool way
          if(!imageBitmap) {
            loadPreviewFallback();
            return;
          }

          // Yay we got our bitmap, let's continue showing the preview
          previewImageLoaded(imageBitmap);
        }
      );
    } else {
      // Create fallback preview
      loadPreviewFallback();
    }

    return null;
  };

  /**
   * Write handler for when the preview image is ready to be animated
   */
  const didDrawPreview = ({root}) => {
    // get last added image
    const image = root.ref.images[root.ref.images.length - 1];
    image.translateY = 0;
    image.scaleX = 1.0;
    image.scaleY = 1.0;
    image.opacity = 1;
  };

  /**
   * Write handler for when the preview has been loaded
   */
  const restoreOverlay = ({root}) => {
    root.ref.overlayShadow.opacity = 1;
    root.ref.overlayError.opacity = 0;
    root.ref.overlaySuccess.opacity = 0;
  };

  const didThrowError = ({root}) => {
    root.ref.overlayShadow.opacity = 0.25;
    root.ref.overlayError.opacity = 1;
  };

  const didCompleteProcessing = ({root}) => {
    root.ref.overlayShadow.opacity = 0.25;
    root.ref.overlaySuccess.opacity = 1;
  };

  /**
   * Constructor
   */
  const create = ({root}) => {
    // image view
    root.ref.images = [];

    // the preview image data (we need this to filter the image)
    root.ref.imageData = null;

    // image bin
    root.ref.imageViewBin = [];

    // image overlays
    root.ref.overlayShadow = root.appendChildView(
      root.createChildView(OverlayView, {opacity: 0, status: 'idle'})
    );

    root.ref.overlaySuccess = root.appendChildView(
      root.createChildView(OverlayView, {opacity: 0, status: 'success'})
    );

    root.ref.overlayError = root.appendChildView(
      root.createChildView(OverlayView, {opacity: 0, status: 'failure'})
    );
  };

  return imageWrapper.utils.createView({
    apis: ['height'],
    create,
    destroy: ({root}) => {
      // We resize the image so memory on iOS 12 is released more quickly (it seems)
      root.ref.images.forEach((imageView) => {
        imageView.image.width = 1;
        imageView.image.height = 1;
      });
    },
    didWriteView: ({root}) => {
      root.ref.images.forEach((imageView) => imageView.dirty = false);
    },
    name: 'image-preview-wrapper',
    styles: ['height'],
    write: imageWrapper.utils.createRoute({
      // image preview stated
      DID_FINISH_CALCULATE_PREVIEWSIZE: drawPreview,
      DID_IMAGE_PREVIEW_CONTAINER_CREATE: didCreatePreviewContainer,
      DID_IMAGE_PREVIEW_DRAW: didDrawPreview,
      DID_UPDATE_ITEM_METADATA: didUpdateItemMetadata,

      // file states
      DID_COMPLETE_ITEM_PROCESSING: didCompleteProcessing,
      DID_REVERT_ITEM_PROCESSING: restoreOverlay,
      DID_START_ITEM_PROCESSING: restoreOverlay,
      DID_THROW_ITEM_INVALID: didThrowError,
      DID_THROW_ITEM_LOAD_ERROR: didThrowError,
      DID_THROW_ITEM_PROCESSING_ERROR: didThrowError
    }, ({root}) => {
      // Views on death row
      const viewsToRemove: any[] = root.ref.imageViewBin.filter((imageView) => imageView.opacity === 0);

      // Views to retain
      root.ref.imageViewBin = root.ref.imageViewBin.filter((imageView) => imageView.opacity > 0);

      // Remove these views
      viewsToRemove.forEach((imageView) => removeImageView(root, imageView));
      viewsToRemove.length = 0;
    })
  });
};
