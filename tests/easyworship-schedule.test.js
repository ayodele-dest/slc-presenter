import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { parseEasyWorshipSchedule } from '../server/easyworship-schedule.js';

const header = 'EasyWorship Schedule File Version    5';
function block(data) {
  const length = Buffer.alloc(4);
  length.writeUInt32LE(data.length);
  return Buffer.concat([length, data]);
}
function fixture(entries) {
  const metadata = Buffer.alloc(0x38 + entries.length * 0x718 + 6);
  metadata.write(header);
  metadata.writeUInt32LE(entries.length, 0x38);
  entries.forEach((entry, index) => metadata.write(entry.title, 0x38 + index * 0x718 + 6));
  return Buffer.concat([metadata, ...entries.flatMap(entry => entry.blocks.map(block))]);
}

test('reads EasyWorship v5 text, image, and blank schedule entries in order', () => {
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
  const bytes = fixture([
    { title: 'Opening song', blocks: [deflateSync(Buffer.from('{\\rtf1\\ansi First line\\par\\par Second line}')), jpg] },
    { title: 'Notice.jpg', blocks: [Buffer.from('BM'), jpg] },
    { title: 'blank', blocks: [deflateSync(Buffer.from([0]))] }
  ]);
  const parsed = parseEasyWorshipSchedule(bytes);
  assert.equal(parsed.version, 5);
  assert.deepEqual(parsed.items.map(item => item.kind), ['text', 'image', 'blank']);
  assert.equal(parsed.items[0].slides.length, 2);
  assert.equal(parsed.items[0].slides[0].text, 'First line');
  assert.equal(parsed.items[1].image.length, 4);
});

test('rejects corrupted or unsupported EasyWorship files before importing', () => {
  const bytes = fixture([{ title: 'blank', blocks: [deflateSync(Buffer.from([0]))] }]);
  assert.throws(() => parseEasyWorshipSchedule(bytes.subarray(0, -2)));
  const unsupported = Buffer.from(bytes);
  unsupported.write('EasyWorship Schedule File Version    4');
  assert.throws(() => parseEasyWorshipSchedule(unsupported), /version 5/i);
});
