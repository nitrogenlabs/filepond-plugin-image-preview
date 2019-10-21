import {getMarkupRect} from './getMarkupRect';
import {getMarkupStyles} from './getMarkupStyles';
import {getMarkupValue} from './getMarkupValue';
import {vectorAdd, vectorMultiply, vectorNormalize, vectorRotate} from './vector';

const setAttributes = (element, attr) => Object.keys(attr).forEach((key) => element.setAttribute(key, attr[key]));

const ns = 'http://www.w3.org/2000/svg';
const svg = (tag, attr?) => {
  const element = document.createElementNS(ns, tag);

  if(attr) {
    setAttributes(element, attr);
  }

  return element;
};

const updateRect = (element) => setAttributes(element, {
  ...element.rect,
  ...element.styles
});

const updateEllipse = (element) => {
  const cx = element.rect.x + (element.rect.width * .5);
  const cy = element.rect.y + (element.rect.height * .5);
  const rx = element.rect.width * .5;
  const ry = element.rect.height * .5;
  return setAttributes(element, {
    cx, cy, rx, ry,
    ...element.styles
  });
};

const IMAGE_FIT_STYLE = {
  contain: 'xMidYMid meet',
  cover: 'xMidYMid slice'
};

const updateImage = (element, markup) => {
  setAttributes(element, {
    ...element.rect,
    ...element.styles,
    preserveAspectRatio: IMAGE_FIT_STYLE[markup.fit] || 'none'
  });
};

const TEXT_ANCHOR = {
  center: 'middle',
  left: 'start',
  right: 'end'
};

const updateText = (element, markup, size, scale) => {
  const fontSize: number = getMarkupValue(markup.fontSize, size, scale);
  const fontFamily: string = markup.fontFamily || 'sans-serif';
  const fontWeight: string = markup.fontWeight || 'normal';
  const textAlign: string = TEXT_ANCHOR[markup.textAlign] || 'start';

  setAttributes(element, {
    ...element.rect,
    ...element.styles,
    'stroke-width': 0,
    'font-weight': fontWeight,
    'font-size': fontSize,
    'font-family': fontFamily,
    'text-anchor': textAlign
  });

  // update text
  if(element.text !== markup.text) {
    element.text = markup.text;
    element.textContent = markup.text.length ? markup.text : ' ';
  }
};

const updateLine = (element, markup, size, scale) => {
  setAttributes(element, {
    ...element.rect,
    ...element.styles,
    fill: 'none'
  });

  const line = element.childNodes[0];
  const begin = element.childNodes[1];
  const end = element.childNodes[2];

  const origin = element.rect;

  const target = {
    x: element.rect.x + element.rect.width,
    y: element.rect.y + element.rect.height
  };

  setAttributes(line, {
    x1: origin.x,
    x2: target.x,
    y1: origin.y,
    y2: target.y
  });

  if(!markup.lineDecoration) {
    return null;
  }

  begin.style.display = 'none';
  end.style.display = 'none';

  const v = vectorNormalize({
    x: target.x - origin.x,
    y: target.y - origin.y
  });

  const l = getMarkupValue(.05, size, scale);

  if(markup.lineDecoration.indexOf('arrow-begin') !== -1) {
    const arrowBeginRotationPoint = vectorMultiply(v, l);
    const arrowBeginCenter = vectorAdd(origin, arrowBeginRotationPoint);
    const arrowBeginA = vectorRotate(origin, 2, arrowBeginCenter);
    const arrowBeginB = vectorRotate(origin, -2, arrowBeginCenter);

    setAttributes(begin, {
      d: `M${arrowBeginA.x},${arrowBeginA.y} L${origin.x},${origin.y} L${arrowBeginB.x},${arrowBeginB.y}`,
      style: 'display:block;'
    });
  }

  if(markup.lineDecoration.indexOf('arrow-end') !== -1) {
    const arrowEndRotationPoint = vectorMultiply(v, -l);
    const arrowEndCenter = vectorAdd(target, arrowEndRotationPoint);
    const arrowEndA = vectorRotate(target, 2, arrowEndCenter);
    const arrowEndB = vectorRotate(target, -2, arrowEndCenter);

    setAttributes(end, {
      style: 'display:block;',
      d: `M${arrowEndA.x},${arrowEndA.y} L${target.x},${target.y} L${arrowEndB.x},${arrowEndB.y}`
    });
  }
};

const createShape = (node) => (markup) => svg(node);

const createImage = (markup) => {
  const shape = svg('image', {
    opacity: '0',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  });
  shape.onload = () => {
    shape.setAttribute('opacity', markup.opacity || 1);
  };
  shape.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', markup.src);
  return shape;
};

const createLine = (markup) => {
  const shape = svg('g', {
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  });

  const line = svg('line');
  shape.appendChild(line);

  const begin = svg('path');
  shape.appendChild(begin);

  const end = svg('path');
  shape.appendChild(end);

  return shape;
};

const CREATE_TYPE_ROUTES = {
  image: createImage,
  rect: createShape('rect'),
  ellipse: createShape('ellipse'),
  text: createShape('text'),
  line: createLine
};

const UPDATE_TYPE_ROUTES = {
  ellipse: updateEllipse,
  image: updateImage,
  line: updateLine,
  rect: updateRect,
  text: updateText
};

export const createMarkupByType = (type, markup) => CREATE_TYPE_ROUTES[type](markup);

export const updateMarkupByType = (element, type, markup, size, scale) => {
  element.rect = getMarkupRect(markup, size, scale);
  element.styles = getMarkupStyles(markup, size, scale);
  UPDATE_TYPE_ROUTES[type](element, markup, size, scale);
};
