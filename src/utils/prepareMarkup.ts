const MARKUP_RECT = [
  'x',
  'y',
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height'
];

const toOptionalFraction = (value) => {
  if(typeof value === 'string' && /%/.test(value)) {
    return parseFloat(value) / 100;
  }

  return value;
};

// adds default markup properties, clones markup
export const prepareMarkup = (markup) => {
  const [type, props] = markup;

  return [
    type,
    {
      zIndex: 0,
      ...props,
      ...MARKUP_RECT.reduce((prev, curr) => {
        prev[curr] = toOptionalFraction(props[curr]);
        return prev;
      }, {})
    }
  ];
};
