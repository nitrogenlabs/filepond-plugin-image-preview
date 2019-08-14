import { createMarkupByType, updateMarkupByType } from '../utils/markup';

const sortMarkupByZIndex = (a, b) => a[1].zIndex > b[1].zIndex ? 1 : -1;

export const createMarkupView = _ => _.utils.createView({
    name: 'image-preview-markup',
    tag: 'svg',
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
    write: ({ root, props }) => {

        if (!props.dirty) return;

        const { crop, resize, markup } = props;

        const viewWidth = props.width;
        const viewHeight = props.height;
        
        let cropWidth = crop.width;
        let cropHeight = crop.height;

        if (resize) {

            const { size } = resize;

            const outputWidth = size && size.width;
            const outputHeight = size && size.height;
            const outputFit = resize.mode;
            const outputUpscale = resize.upscale;
            
            if (outputWidth && !outputHeight) outputHeight = outputWidth;
            if (outputHeight && !outputWidth) outputWidth = outputHeight;

            const shouldUpscale = cropWidth < outputWidth && cropHeight < outputHeight;
            
            if (!shouldUpscale || (shouldUpscale && outputUpscale)) {

                let scalarWidth = outputWidth / cropWidth;
                let scalarHeight = outputHeight / cropHeight;
    
                if (outputFit === 'force') {
                    cropWidth = outputWidth;
                    cropHeight = outputHeight;
                }
                else {
                    let scalar;
                    if (outputFit === 'cover') {
                        scalar = Math.max(scalarWidth, scalarHeight);
                    }
                    else if (outputFit === 'contain') {
                        scalar = Math.min(scalarWidth, scalarHeight);
                    }
                    cropWidth = cropWidth * scalar;
                    cropHeight = cropHeight * scalar;
                }

            }

        }

        const size = {
            width: viewWidth,
            height: viewHeight
        };
        root.element.setAttribute('width', size.width);
        root.element.setAttribute('height', size.height);

        const scale = Math.min(
            viewWidth / cropWidth, 
            viewHeight / cropHeight
        );

        // clear
        root.element.innerHTML = '';

        // get filter
        const markupFilter = root.query('GET_IMAGE_PREVIEW_MARKUP_FILTER');

        // draw new
        markup.filter(markupFilter).sort(sortMarkupByZIndex).forEach(markup => {

            const [type, settings] = markup;

            // create
            const element = createMarkupByType(type, settings);

            // update
            updateMarkupByType(element, type, settings, size, scale);
            
            // add
            root.element.appendChild(element);
            
        });
    }

});