import {getCenteredCropRect, getCurrentCropSize, getImageRectZoomFactor} from '../utils/crop';
import {createMarkupView} from './createMarkupView';

const IMAGE_SCALE_SPRING_PROPS = {
  damping: 0.45,
  mass: 10,
  stiffness: 0.5,
  type: 'spring'
};

// does horizontal and vertical flipping
const createBitmapView = (bitmapView) => bitmapView.utils.createView({
  create: ({root, props: {image}}) => root.appendChild(image),
  ignoreRect: true,
  mixins: {styles: ['scaleX', 'scaleY']},
  name: 'image-bitmap'
});

// shifts and rotates image
const createImageCanvasWrapper = (wrapper) => wrapper.utils.createView({
  create: ({root, props}) => {
    const {image} = props;
    const {height: imageHeight, width: imageWidth} = image;

    props.width = Math.min(imageHeight, imageWidth);
    props.height = props.width;
    // props.width = imageWidth;
    // props.height = imageHeight;

    root.ref.bitmap = root.appendChildView(root.createChildView(createBitmapView(wrapper), {image}));
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

      root.ref.markup = root.appendChildView(root.createChildView(createMarkupView(clipView), {...props}));

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
    const {
      crop,
      dirty,
      height,
      image: {clientWidth: imageWidth, clientHeight: imageHeight},
      markup,
      resize,
      width
    } = props;
    let scaleHeight: number = 1;
    let scaleWidth: number = 1;

    if(imageHeight > height && imageWidth > width) {
      scaleHeight = Math.min(imageHeight, height) / Math.max(imageHeight, height);
      scaleWidth = Math.min(imageWidth, width) / Math.max(imageWidth, width);
    } else {
      scaleHeight = Math.max(imageHeight, height) / Math.min(imageHeight, height);
      scaleWidth = Math.max(imageWidth, width) / Math.min(imageWidth, width);
    }

    // const scale = crop.zoom * stageZoomFactor;
    const scale: number = Math.max(scaleHeight, scaleWidth);

    console.log('createImageView::props', props);
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
      height: imageHeight * scale,
      width: imageWidth * scale
    };

    console.log('createImageView::ref.image', root.ref.image);
    const origin = {
      x: crop.center.x * (image.width - width), // 0.5 * (408 - x) = 0.8
      y: crop.center.y * (image.height - height)
    };

    console.log('createImageView::stage', stage);
    console.log('createImageView::crop', crop);
    console.log('createImageView::image', image);
    const translation = {
      x: (stage.center.x * (1 / crop.center.x)) - image.width,
      y: (stage.center.y * (1 / crop.center.y)) - image.height
    };
    console.log('createImageView::origin', origin);
    console.log('createImageView::translation', translation);

    const rotation = (Math.PI * 2) + (crop.rotation % (Math.PI * 2));

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
    const {crop, markup, resize, dirty} = props;

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

    const fixedPreviewHeight = root.query('GET_IMAGE_PREVIEW_HEIGHT');

    clip.width = fixedPreviewHeight;
    clip.height = fixedPreviewHeight;

    return null;
  }
});
