import assert from 'node:assert/strict';
import { build } from 'esbuild';

let lastCanvas;
class MockContext {
  texts = [];
  measureText(value) { return { width: [...value].length * 25 }; }
  createLinearGradient() { return { addColorStop() {} }; }
  fillRect() {} strokeRect() {} save() {} restore() {} translate() {} scale() {} beginPath() {} moveTo() {} quadraticCurveTo() {} lineTo() {} stroke() {} drawImage() {} roundRect() {} fill() {}
  fillText(text, x, y) { this.texts.push({ text, x, y }); }
}
class MockCanvas {
  width = 0; height = 0; context = new MockContext();
  getContext() { return this.context; }
  toBlob(callback) { callback(new Blob(['png'], { type: 'image/png' })); }
}
globalThis.document = { fonts: { ready: Promise.resolve() }, createElement: () => (lastCanvas = new MockCanvas()) };
globalThis.Image = class { naturalWidth = 2100; naturalHeight = 600; async decode() {} };
const compiled = await build({ entryPoints: ['src/lib/dailyMenuPoster.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { generateDailyMenuPoster } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const menu = { scheduledDate: '2026-11-20', soups: ['Sopa de carne', 'Sancocho de bagre'], sides: ['Lentejas'], proteins: ['Filete de pescado'], specials: [{ name: 'Encocado de piangua', price: 25000 }] };
const blob = await generateDailyMenuPoster(menu);
assert.equal(blob.type, 'image/png');
const text = lastCanvas.context.texts.map(item => item.text);
assert.ok(text.includes('MENÚ DEL VIERNES'));
for (const expected of ['SOPAS', 'Sopa de carne', 'PRINCIPIOS', 'Lentejas', 'PROTEÍNAS', 'Filete de pescado', 'ESPECIALES', 'Encocado de piangua', '3113731844']) assert.ok(text.includes(expected), expected);
assert.ok(lastCanvas.context.texts.every(item => item.y < lastCanvas.height));
await assert.rejects(generateDailyMenuPoster({ ...menu, scheduledDate: '2026-02-31' }), /fecha válida/);
await assert.rejects(generateDailyMenuPoster({ ...menu, soups: [], sides: [], proteins: [], specials: [] }), /al menos una opción/);
await generateDailyMenuPoster({ ...menu, soups: Array.from({ length: 35 }, (_, i) => `Sopa ${i + 1}`), sides: [], proteins: [], specials: [] });
assert.ok(lastCanvas.height > 1920);
assert.ok(lastCanvas.context.texts.some(item => item.text === 'Sopa 35'));
assert.ok(lastCanvas.context.texts.every(item => item.y < lastCanvas.height));
console.log('PASS: cartel usa fecha, textos y teléfono correctos, crece con el contenido y rechaza datos inválidos.');
