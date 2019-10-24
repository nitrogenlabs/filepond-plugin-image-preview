let SVG_MASK: string = `<svg width="500" height="200" viewBox="0 0 500 200" preserveAspectRatio="none">
    <defs>
        <radialGradient id="gradient-__UID__" cx=".5" cy="1.25" r="1.15">
            <stop offset='50%' stop-color='#000000'/>
            <stop offset='56%' stop-color='#0a0a0a'/>
            <stop offset='63%' stop-color='#262626'/>
            <stop offset='69%' stop-color='#4f4f4f'/>
            <stop offset='75%' stop-color='#808080'/>
            <stop offset='81%' stop-color='#b1b1b1'/>
            <stop offset='88%' stop-color='#dadada'/>
            <stop offset='94%' stop-color='#f6f6f6'/>
            <stop offset='100%' stop-color='#ffffff'/>
        </radialGradient>
        <mask id="mask-__UID__">
            <rect x="0" y="0" width="500" height="200" fill="url(#gradient-__UID__)"></rect>
        </mask>
    </defs>
    <rect x="0" width="500" height="200" fill="currentColor" mask="url(#mask-__UID__)"></rect>
</svg>`;

let checkedMyBases: boolean = false;
let SVGMaskUniqueId: number = 0;

export const createImageOverlayView = (fpAPI) =>
  fpAPI.utils.createView({
    create: ({root, props}) => {
      if(!checkedMyBases && document.querySelector('base')) {
        SVG_MASK = SVG_MASK.replace(/url\(\#/g, `url(${window.location.href.replace(window.location.hash, '')}#`);
        checkedMyBases = true;
      }

      SVGMaskUniqueId = SVGMaskUniqueId + 1;
      root.element.classList.add(`filepond--image-preview-overlay-${props.status}`);
      root.element.innerHTML = SVG_MASK.replace(/__UID__/g, SVGMaskUniqueId as any);
    },
    ignoreRect: true,
    mixins: {
      animations: {
        opacity: {mass: 25, type: 'spring'}
      },
      styles: ['opacity']
    },
    name: 'image-preview-overlay',
    tag: 'div'
  });
