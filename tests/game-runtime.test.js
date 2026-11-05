import test from 'node:test';
import assert from 'node:assert/strict';

test('starting the game advances time and spawns drawable balls', async () => {
  let now = 0;
  const queuedFrames = [];
  let ballTranslations = 0;
  let clearedFrames = 0;
  let duckWalkDraws = 0;
  let ballSpriteDraws = 0;
  const windowListeners = {};
  const selectors = [
    '#game', '#speech-bubble', '#overlay', '#game-title', '#start-button', '#time-value',
    '#best-value', '#level-value', '#threat-dots', '#overlay-title', '#overlay-copy', '#overlay-eyebrow'
  ];
  const elements = new Map(selectors.map((selector) => [selector, {
    textContent: '', innerHTML: '', hidden: false, style: {}, attributes: {},
    classList: { add() {}, remove() {}, contains() { return false; } },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(type, callback) { this.listeners ??= {}; this.listeners[type] = callback; }
  }]));
  const context = new Proxy({}, {
    get(target, key) {
      if (key === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (key === 'drawImage') return (image) => {
        if (image?.src?.includes('duck-walk-')) duckWalkDraws++;
        if (image?.src?.includes('assets/balls/rotation-')) ballSpriteDraws++;
      };
      if (!(key in target)) target[key] = key === 'translate'
        ? () => { ballTranslations++; }
        : key === 'clearRect'
          ? () => { clearedFrames++; }
        : () => {};
      return target[key];
    },
    set(target, key, value) { target[key] = value; return true; }
  });
  const canvas = elements.get('#game');
  Object.assign(canvas, {
    width: 960,
    height: 510,
    getContext() { return context; },
    getBoundingClientRect() { return { width: 960, height: 510, left: 0, top: 0 }; },
    setPointerCapture() {}
  });

  globalThis.document = {
    hidden: false,
    body: {},
    querySelector(selector) { return elements.get(selector) ?? null; },
    querySelectorAll() { return []; },
    createElement(name) {
      assert.equal(name, 'canvas');
      let width = 0;
      let height = 0;
      return {
        set width(value) { width = value; },
        get width() { return width; },
        set height(value) { height = value; },
        get height() { return height; },
        getContext() {
          return {
            drawImage() {},
            getImageData() { return { data: new Uint8ClampedArray(width * height * 4) }; }
          };
        }
      };
    },
    addEventListener() {}
  };
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener(type, callback) { windowListeners[type] = callback; },
    visualViewport: { addEventListener() {} },
    setInterval() { return 1; },
    location: { reload() {} }
  };
  globalThis.localStorage = { getItem() { return null; }, setItem() {} };
  globalThis.performance = { now() { return now; } };
  globalThis.requestAnimationFrame = (callback) => { queuedFrames.push(callback); return queuedFrames.length; };
  globalThis.Image = class {
    constructor() { this.complete = true; this.naturalWidth = 619; this.naturalHeight = 1415; }
    addEventListener() {}
    get src() { return this._src; }
    set src(path) {
      this._src = path;
      if (path.includes('duck-walk-')) { this.naturalWidth = 724; this.naturalHeight = 724; }
      else if (path.includes('duck')) { this.naturalWidth = 745; this.naturalHeight = 1022; }
      else if (path.includes('jump-')) { this.naturalWidth = 262; this.naturalHeight = 556; }
      else if (path.includes('assets/balls/rotation-')) { this.naturalWidth = 255; this.naturalHeight = 261; }
    }
  };

  await import(`../game.js?runtime-test=${Date.now()}`);
  elements.get('#start-button').listeners.click();
  windowListeners.keydown({ key: 'ArrowDown', repeat: false, preventDefault() {} });
  windowListeners.keydown({ key: 'ArrowRight', repeat: false, preventDefault() {} });

  for (let tick = 0; tick < 90 && queuedFrames.length; tick++) {
    now += 1000 / 60;
    queuedFrames.shift()(now);
  }

  assert.ok(Number.parseFloat(elements.get('#time-value').textContent) >= 1.4,
    'the game timer advances after the start click');
  assert.ok(ballTranslations > 0, 'spawned footballs are drawn');
  assert.ok(duckWalkDraws > 0, 'walking while crouched draws the crouch-walk sprite animation');
  assert.ok(ballSpriteDraws > 0, 'football rotation frames are drawn from the supplied sprite sheet');
  assert.ok(clearedFrames > 0, 'the full canvas is cleared between frames to prevent edge trails');
  assert.notEqual(elements.get('#overlay-title').textContent, 'O jogo encontrou um erro');
});
