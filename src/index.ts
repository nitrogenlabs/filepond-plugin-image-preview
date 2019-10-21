import {isBitmap} from './utils/isBitmap';
import {isPreviewableImage} from './utils/isPreviewableImage';
import {createImageWrapperView} from './view/createImageWrapperView';

/**
 * Image Preview Plugin
 */
const plugin = (fpAPI) => {
  const {addFilter, utils} = fpAPI;
  const {Type, createRoute, isFile} = utils;

  // imagePreviewView
  const imagePreviewView = createImageWrapperView(fpAPI);

  // Called for each view that is created right after the 'create' method
  addFilter('CREATE_VIEW', (viewAPI) => {
    // Get reference to created view
    const {is, view, query} = viewAPI;

    // Only hook up to item view and only if is enabled for this cropper
    if(!is('file') || !query('GET_ALLOW_IMAGE_PREVIEW')) {
      return null;
    }

    // Create the image preview plugin, but only do so if the item is an image
    const didLoadItem = ({root, props}) => {
      const {id} = props;
      const item = query('GET_ITEM', id);

      // Item could theoretically have been removed in the mean time
      if(!item || !isFile(item.file) || item.archived) {
        return null;
      }

      // Get the file object
      const {file} = item;

      // Exit if this is not an image
      if(!isPreviewableImage(file)) {
        return null;
      }

      // Test if is filtered
      if(!query('GET_IMAGE_PREVIEW_FILTER_ITEM')(item)) {
        return null;
      }

      // Exit if image size is too high and no createImageBitmap support
      // this would simply bring the browser to its knees and that is not what we want
      const supportsCreateImageBitmap = 'createImageBitmap' in (window || {});
      const maxPreviewFileSize: number = query('GET_IMAGE_PREVIEW_MAX_FILE_SIZE');

      if(!supportsCreateImageBitmap && (maxPreviewFileSize && file.size > maxPreviewFileSize)) {
        return null;
      }

      // Set preview view
      root.ref.imagePreview = view.appendChildView(view.createChildView(imagePreviewView, {id}));

      // Update height if is fixed
      const fixedPreviewHeight = root.query('GET_IMAGE_PREVIEW_HEIGHT');

      if(fixedPreviewHeight) {
        root.dispatch('DID_UPDATE_PANEL_HEIGHT', {
          height: fixedPreviewHeight,
          id: item.id
        });
      }

      // Now ready
      const queue = !supportsCreateImageBitmap && file.size > query('GET_IMAGE_PREVIEW_MAX_INSTANT_PREVIEW_FILE_SIZE');
      root.dispatch('DID_IMAGE_PREVIEW_CONTAINER_CREATE', {id}, queue);
    };

    const rescaleItem = (root, props) => {
      if(!root.ref.imagePreview) {
        return null;
      }

      const {id} = props;

      // Get item
      const item = root.query('GET_ITEM', {id});
      if(!item) {
        return null;
      }

      // If is fixed height or panel has aspect ratio, exit here, height has already been defined
      const panelAspectRatio: number = root.query('GET_PANEL_ASPECT_RATIO');
      const itemPanelAspectRatio: number = root.query('GET_ITEM_PANEL_ASPECT_RATIO');
      const fixedHeight: number = root.query('GET_IMAGE_PREVIEW_HEIGHT');

      if(panelAspectRatio || itemPanelAspectRatio || fixedHeight) {
        return null;
      }

      // No data!
      let {imageWidth, imageHeight} = root.ref;

      if(!imageWidth || !imageHeight) {
        return null;
      }

      // Get height min and max
      const minPreviewHeight: number = root.query('GET_IMAGE_PREVIEW_MIN_HEIGHT');
      const maxPreviewHeight: number = root.query('GET_IMAGE_PREVIEW_MAX_HEIGHT');

      // Orientation info
      const exif = item.getMetadata('exif') || {};
      const orientation: number = exif.orientation || -1;

      // Get width and height from action, and swap of orientation is incorrect
      if(orientation >= 5 && orientation <= 8) {
        [imageWidth, imageHeight] = [imageHeight, imageWidth];
      }

      // Scale up width and height when we're dealing with an SVG
      if(!isBitmap(item.file) || root.query('GET_IMAGE_PREVIEW_UPSCALE')) {
        const scalar = 2048 / imageWidth;
        imageWidth *= scalar;
        imageHeight *= scalar;
      }

      // Image aspect ratio
      const imageAspectRatio: number = imageHeight / imageWidth;

      // We need the item to get to the crop size
      const previewAspectRatio: number = (item.getMetadata('crop') || {}).aspectRatio || imageAspectRatio;

      // Preview height range
      const previewHeightMax: number = Math.max(minPreviewHeight, Math.min(imageHeight, maxPreviewHeight));
      const itemWidth: number = root.rect.element.width;
      const previewHeight: number = Math.min(itemWidth * previewAspectRatio, previewHeightMax);

      // Request update to panel height
      root.dispatch('DID_UPDATE_PANEL_HEIGHT', {
        height: previewHeight,
        id: item.id
      });

      return null;
    };

    const didResizeView = ({root}) => {
      // Actions in next write operation
      root.ref.shouldRescale = true;
    };

    const didUpdateItemMetadata = ({root, action}) => {
      if(action.change.key !== 'crop') {
        return null;
      }

      // Actions in next write operation
      root.ref.shouldRescale = true;
      return null;
    };

    const didCalculatePreviewSize = ({root, action}) => {
      // Remember dimensions
      root.ref.imageWidth = action.width;
      root.ref.imageHeight = action.height;

      // Actions in next write operation
      root.ref.shouldRescale = true;
      root.ref.shouldDrawPreview = true;

      // As image load could take a while and fire when draw loop is resting we need to give it a kick
      root.dispatch('KICK');
    };

    // Start writing
    view.registerWriter(
      createRoute({
        DID_IMAGE_PREVIEW_CALCULATE_SIZE: didCalculatePreviewSize,
        DID_LOAD_ITEM: didLoadItem,
        DID_RESIZE_ROOT: didResizeView,
        DID_STOP_RESIZE: didResizeView,
        DID_UPDATE_ITEM_METADATA: didUpdateItemMetadata
      }, ({root, props}) => {
        // No preview view attached
        if(!root.ref.imagePreview) {
          return null;
        }

        // Don't do anything while hidden
        if(root.rect.element.hidden) {
          return null;
        }

        // Resize the item panel
        if(root.ref.shouldRescale) {
          rescaleItem(root, props);
          root.ref.shouldRescale = false;
        }

        if(root.ref.shouldDrawPreview) {
          // Queue till next frame so we're sure the height has been applied this forces the draw image call inside
          // the wrapper view to use the correct height
          requestAnimationFrame(() => {
            root.dispatch('DID_FINISH_CALCULATE_PREVIEWSIZE', {id: props.id});
          });
          root.ref.shouldDrawPreview = false;
        }

        return null;
      })
    );

    return null;
  });

  // Expose plugin
  return {
    options: {
      // Enable or disable image preview
      allowImagePreview: [true, Type.BOOLEAN],

      // Enables or disables reading average image color
      imagePreviewCalculateAverageImageColor: [false, Type.BOOLEAN],

      // Filters file items to determine which are shown as preview
      imagePreviewFilterItem: [() => true, Type.FUNCTION],

      // Fixed preview height
      imagePreviewHeight: [null, Type.INT],

      // Allows filtering of markup to only show certain shapes
      imagePreviewMarkupFilter: [() => true, Type.FUNCTION],

      // Enables or disables the previewing of markup
      imagePreviewMarkupShow: [true, Type.BOOLEAN],

      // Max size of preview file for when createImageBitmap is not supported
      imagePreviewMaxFileSize: [null, Type.INT],

      // Max image height
      imagePreviewMaxHeight: [256, Type.INT],

      // Max size of preview file that we allow to try to instant preview if createImageBitmap is not supported, else
      // image is queued for loading
      imagePreviewMaxInstantPreviewFileSize: [1000000, Type.INT],

      // Min image height
      imagePreviewMinHeight: [44, Type.INT],

      // Style of the transparancy indicator used behind images
      imagePreviewTransparencyIndicator: [null, Type.STRING],

      // Should we upscale small images to fit the max bounding box of the preview area
      imagePreviewUpscale: [false, Type.BOOLEAN],

      // The amount of extra pixels added to the image preview to allow comfortable zooming
      imagePreviewZoomFactor: [2, Type.INT]
    }
  };
};

// Fire pluginloaded event if running in browser, this allows registering the plugin when using async script tags
const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

if(isBrowser) {
  document.dispatchEvent(new CustomEvent('FilePond:pluginloaded', {detail: plugin}));
}

export default plugin;
