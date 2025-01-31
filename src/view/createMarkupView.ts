import {createMarkupByType, updateMarkupByType} from '../utils/markup';
import {prepareMarkup} from '../utils/prepareMarkup';

const sortMarkupByZIndex = (a, b) => {
  if(a[1].zIndex > b[1].zIndex) {
    return 1;
  }
  if(a[1].zIndex < b[1].zIndex) {
    return -1;
  }
  return 0;
};

export const createMarkupView = (markupView) => markupView.utils.createView({
  ignoreRect: true,
  mixins: {
    apis: [
      'width',
      'height',
      'crop',
      'markup',
      'resize',
      'dirty'
    ]
  },
  name: 'image-preview-markup',
  tag: 'svg',
  write: ({root, props}) => {
    if(!props.dirty) {
      return null;
    }

    const {crop, resize, markup} = props;
    const viewWidth = props.width;
    const viewHeight = props.height;
    let cropWidth = crop.width;
    let cropHeight = crop.height;

    if(resize) {
      const {size} = resize;
      let outputWidth = size && size.width;
      let outputHeight = size && size.height;
      const outputFit = resize.mode;
      const outputUpscale: number = resize.upscale;

      if(outputWidth && !outputHeight) {
        outputHeight = outputWidth;
      }

      if(outputHeight && !outputWidth) {
        outputWidth = outputHeight;
      }

      const shouldUpscale: boolean = cropWidth < outputWidth && cropHeight < outputHeight;

      if(!shouldUpscale || (shouldUpscale && outputUpscale)) {
        const scalarWidth: number = outputWidth / cropWidth;
        const scalarHeight: number = outputHeight / cropHeight;

        if(outputFit === 'force') {
          cropWidth = outputWidth;
          cropHeight = outputHeight;
        } else {
          let scalar;
          if(outputFit === 'cover') {
            scalar = Math.max(scalarWidth, scalarHeight);
          } else if(outputFit === 'contain') {
            scalar = Math.min(scalarWidth, scalarHeight);
          }
          cropWidth = cropWidth * scalar;
          cropHeight = cropHeight * scalar;
        }
      }
    }

    const size = {
      height: viewHeight,
      width: viewWidth
    };

    root.element.setAttribute('width', size.width);
    root.element.setAttribute('height', size.height);

    const scale: number = Math.max(
      viewWidth / cropWidth,
      viewHeight / cropHeight
    );

    // clear
    root.element.innerHTML = '';

    // get filter
    const markupFilter = root.query('GET_IMAGE_PREVIEW_MARKUP_FILTER');

    // draw new
    markup.filter(markupFilter).map(prepareMarkup).sort(sortMarkupByZIndex).forEach((markup) => {
      const [type, settings] = markup;

      // create
      const element = createMarkupByType(type, settings);

      // update
      updateMarkupByType(element, type, settings, size, scale);

      // add
      root.element.appendChild(element);
    });

    return null;
  }
});
