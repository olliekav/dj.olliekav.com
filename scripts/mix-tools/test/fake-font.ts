import opentype from 'opentype.js';

const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** A tiny font with the glyph names the artwork uses, each a 500×700 box. */
export const fakeFont = (names = ['numbersign', ...DIGITS.map(d => `${d}.lf`)]) => {
  const box = () => {
    const path = new opentype.Path();
    path.moveTo(0, 0);
    path.lineTo(500, 0);
    path.quadraticCurveTo(550, 350, 500, 700);
    path.bezierCurveTo(400, 750, 100, 750, 0, 700);
    path.close();
    return path;
  };
  const glyphs = [
    new opentype.Glyph({ name: '.notdef', unicode: 0, advanceWidth: 500, path: new opentype.Path() }),
    ...names.map((name, i) => new opentype.Glyph({ name, unicode: 0xe000 + i, advanceWidth: 600, path: box() }))
  ];
  return new opentype.Font({ familyName: 'Fake', styleName: 'Black', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs });
};
