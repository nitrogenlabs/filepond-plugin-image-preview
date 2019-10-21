import {getCenteredCropRect, getCurrentCropSize, getImageRectZoomFactor} from '../utils/crop';
import {createMarkupView} from './createMarkupView';

const IMAGE_SCALE_SPRING_PROPS = {
  type: 'spring',
  stiffness: 0.5,
  damping: 0.45,
  mass: 10
};

// does horizontal and vertical flipping
const createBitmapView = (bitmapView) => bitmapView.utils.createView({
  create: ({root, props: {image}}) => {
    root.appendChild(image);
  },
  ignoreRect: true,
  mixins: {styles: ['scaleX', 'scaleY']},
  name: 'image-bitmap'
});

// shifts and rotates image
const createImageCanvasWrapper = (wrapper) => wrapper.utils.createView({
  create: ({root, props}) => {
    const {image} = props;
    const {height: imageHeight, width: imageWidth} = image;

    props.width = imageWidth;
    props.height = imageHeight;

    root.ref.bitmap = root.appendChildView(
      root.createChildView(createBitmapView(wrapper), {image})
    );
  },
  ignoreRect: true,
  mixins: {
    animations: {
      originX: IMAGE_SCALE_SPRING_PROPS,
      originY: IMAGE_SCALE_SPRING_PROPS,
      rotateZ: IMAGE_SCALE_SPRING_PROPS,
      scaleX: IMAGE_SCALE_SPRING_PROPS,
      scaleY: IMAGE_SCALE_SPRING_PROPS,
      translateX: IMAGE_SCALE_SPRING_PROPS,
      translateY: IMAGE_SCALE_SPRING_PROPS
    },
    apis: [
      'crop',
      'width',
      'height'
    ],
    styles: [
      'originX',
      'originY',
      'translateX',
      'translateY',
      'scaleX',
      'scaleY',
      'rotateZ'
    ]
  },
  name: 'image-canvas-wrapper',
  tag: 'div',
  write: ({root, props}) => {
    const {flip} = props.crop;
    const {bitmap} = root.ref;
    bitmap.scaleX = flip.horizontal ? -1 : 1;
    bitmap.scaleY = flip.vertical ? -1 : 1;
  }
});

// clips canvas to correct aspect ratio
const createClipView = (clipView) => clipView.utils.createView({
  create: ({root, props}) => {
    root.ref.image = root.appendChildView(
      root.createChildView(createImageCanvasWrapper(clipView), {...props})
    );

    root.ref.createMarkup = () => {
      if(root.ref.markup) {
        return null;
      }

      root.ref.markup = root.appendChildView(
        root.createChildView(createMarkupView(clipView), {...props})
      );

      return null;
    };

    root.ref.destroyMarkup = () => {
      if(!root.ref.markup) {
        return null;
      }

      root.removeChildView(root.ref.markup);
      root.ref.markup = null;

      return null;
    };

    // set up transparency grid
    const transparencyIndicator = root.query('GET_IMAGE_PREVIEW_TRANSPARENCY_INDICATOR');
    if(transparencyIndicator === null) {
      return;
    }

    if(transparencyIndicator === 'grid') {
      // Grid pattern
      root.element.dataset.transparencyIndicator = transparencyIndicator;
    } else {
      // Basic color
      root.element.dataset.transparencyIndicator = 'color';
    }
  },
  didWriteView: ({root, props}) => {
    if(!props.background) {
      return null;
    }

    root.element.style.backgroundColor = props.background;

    return null;
  },
  ignoreRect: true,
  mixins: {
    animations: {
      opacity: {duration: 250, type: 'tween'}
    },
    apis: [
      'crop',
      'markup',
      'resize',
      'width',
      'height',
      'dirty',
      'background'
    ],
    styles: ['width', 'height', 'opacity']
  },
  name: 'image-clip',
  tag: 'div',
  write: ({root, props, shouldOptimize}) => {
    const {crop, markup, resize, dirty, width, height} = props;

    root.ref.image.crop = crop;

    const stage = {
      center: {
        x: width * .5,
        y: height * .5
      },
      height,
      width,
      x: 0,
      y: 0
    };

    const image = {
      height: root.ref.image.height,
      width: root.ref.image.width
    };

    const origin = {
      x: crop.center.x * image.width,
      y: crop.center.y * image.height
    };

    const translation = {
      x: stage.center.x - (image.width * crop.center.x),
      y: stage.center.y - (image.height * crop.center.y)
    };

    const rotation = (Math.PI * 2) + (crop.rotation % (Math.PI * 2));

    const cropAspectRatio = crop.aspectRatio || image.height / image.width;

    const shouldLimit = typeof crop.scaleToFit === 'undefined' || crop.scaleToFit;

    const stageZoomFactor = getImageRectZoomFactor(
      image,
      getCenteredCropRect(
        stage,
        cropAspectRatio
      ),
      rotation,
      shouldLimit ? crop.center : {x: .5, y: .5}
    );

    const scale = crop.zoom * stageZoomFactor;

    // update markup view
    if(markup && markup.length) {
      root.ref.createMarkup();
      root.ref.markup.width = width;
      root.ref.markup.height = height;
      root.ref.markup.resize = resize;
      root.ref.markup.dirty = dirty;
      root.ref.markup.markup = markup;
      root.ref.markup.crop = getCurrentCropSize(image, crop);
    } else if(root.ref.markup) {
      root.ref.destroyMarkup();
    }

    // update image view
    const imageView = root.ref.image;

    // don't update clip layout
    if(shouldOptimize) {
      imageView.originX = null;
      imageView.originY = null;
      imageView.translateX = null;
      imageView.translateY = null;
      imageView.rotateZ = null;
      imageView.scaleX = null;
      imageView.scaleY = null;
      return;
    }

    imageView.originX = origin.x;
    imageView.originY = origin.y;
    imageView.translateX = translation.x;
    imageView.translateY = translation.y;
    imageView.rotateZ = rotation;
    imageView.scaleX = scale;
    imageView.scaleY = scale;
  }
});

export const createImageView = (imageView) => imageView.utils.createView({
  create: ({root, props}) => {
    const {background, crop, dirty, id, image, markup, resize} = props;

    root.ref.clip = root.appendChildView(
      root.createChildView(createClipView(imageView), {
        background,
        crop,
        dirty,
        id,
        image,
        markup,
        resize
      })
    );
  },
  ignoreRect: true,
  mixins: {
    animations: {
      opacity: {duration: 400, type: 'tween'},
      scaleX: IMAGE_SCALE_SPRING_PROPS,
      scaleY: IMAGE_SCALE_SPRING_PROPS,
      translateY: IMAGE_SCALE_SPRING_PROPS
    },
    apis: [
      'image',
      'crop',
      'markup',
      'resize',
      'dirty',
      'background'
    ],
    styles: [
      'translateY',
      'scaleX',
      'scaleY',
      'opacity'
    ]
  },
  name: 'image-preview',
  tag: 'div',
  write: ({root, props, shouldOptimize}) => {
    const {clip} = root.ref;
    const {image, crop, markup, resize, dirty} = props;

    clip.crop = crop;
    clip.markup = markup;
    clip.resize = resize;
    clip.dirty = dirty;

    // don't update clip layout
    clip.opacity = shouldOptimize ? 0 : 1;

    // don't re-render if optimizing or hidden (width will be zero resulting in weird animations)
    if(shouldOptimize || root.rect.element.hidden) {
      return null;
    }

    // calculate scaled preview image size
    const imageAspectRatio = image.height / image.width;
    let aspectRatio = crop.aspectRatio || imageAspectRatio;

    // calculate container size
    const containerWidth = root.rect.inner.width;
    const containerHeight = root.rect.inner.height;

    let fixedPreviewHeight = root.query('GET_IMAGE_PREVIEW_HEIGHT');
    const minPreviewHeight = root.query('GET_IMAGE_PREVIEW_MIN_HEIGHT');
    const maxPreviewHeight = root.query('GET_IMAGE_PREVIEW_MAX_HEIGHT');

    const panelAspectRatio = root.query('GET_PANEL_ASPECT_RATIO');
    const allowMultiple = root.query('GET_ALLOW_MULTIPLE');

    if(panelAspectRatio && !allowMultiple) {
      fixedPreviewHeight = containerWidth * panelAspectRatio;
      aspectRatio = panelAspectRatio;
    }

    // determine clip width and height
    let clipHeight =
      fixedPreviewHeight !== null
        ? fixedPreviewHeight
        : Math.max(
          minPreviewHeight,
          Math.min(
            containerWidth * aspectRatio,
            maxPreviewHeight
          )
        );

    let clipWidth = clipHeight / aspectRatio;
    if(clipWidth > containerWidth) {
      clipWidth = containerWidth;
      clipHeight = clipWidth * aspectRatio;
    }

    if(clipHeight > containerHeight) {
      clipHeight = containerHeight;
      clipWidth = containerHeight / aspectRatio;
    }

    clip.width = clipWidth;
    clip.height = clipHeight;

    return null;
  }
});
