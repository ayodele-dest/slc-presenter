import { inflateSync } from 'node:zlib';
import { rtfToText } from './presenter-library.js';
import { parseLyrics } from '../src/song-parser.js';

const MAGIC = 'EasyWorship Schedule File Version    5';
const HEADER_COUNT_OFFSET = 0x38;
const RECORD_SIZE = 0x718;
const MAX_ITEMS = 1000;
const MAX_BLOCK = 100 * 1024 * 1024;

function nullTerminated(bytes, start, max) {
  const end = Math.min(bytes.length, start + max);
  let stop = start;
  while (stop < end && bytes[stop] !== 0) stop++;
  return bytes.toString('utf8', start, stop).trim();
}

function blockAt(bytes, offset) {
  if (offset + 4 > bytes.length) throw new Error('The EasyWorship schedule is truncated.');
  const length = bytes.readUInt32LE(offset);
  if (!length || length > MAX_BLOCK || offset + 4 + length > bytes.length) {
    throw new Error('The EasyWorship schedule has an invalid embedded item.');
  }
  return { data: bytes.subarray(offset + 4, offset + 4 + length), next: offset + 4 + length };
}

export function parseEasyWorshipSchedule(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < HEADER_COUNT_OFFSET + RECORD_SIZE) {
    throw new Error('The selected file is not a complete EasyWorship schedule.');
  }
  if (bytes.toString('ascii', 0, MAGIC.length) !== MAGIC) {
    throw new Error('Only EasyWorship Schedule version 5 files are supported.');
  }
  const count = bytes.readUInt32LE(HEADER_COUNT_OFFSET);
  if (!count || count > MAX_ITEMS) throw new Error('The EasyWorship schedule has an invalid item count.');
  const recordsEnd = HEADER_COUNT_OFFSET + count * RECORD_SIZE;
  if (recordsEnd + 14 > bytes.length) throw new Error('The EasyWorship schedule is truncated.');
  const titles = Array.from({ length: count }, (_, index) => {
    const title = nullTerminated(bytes, HEADER_COUNT_OFFSET + index * RECORD_SIZE + 6, 256);
    if (!title || /[\x00-\x08\x0e-\x1f]/.test(title)) throw new Error(`Invalid EasyWorship item ${index + 1}.`);
    return title;
  });
  const items = [];
  let offset = recordsEnd + 6;
  for (let index = 0; index < count; index++) {
    let block = blockAt(bytes, offset);
    let content = block.data;
    offset = block.next;
    let text = '';
    if (content[0] === 0x78 && [0x01, 0x9c, 0xda].includes(content[1])) {
      const inflated = inflateSync(content, { maxOutputLength: 10 * 1024 * 1024 });
      const rtf = inflated.toString('latin1');
      if (rtf.startsWith('{\\rtf')) text = rtfToText(rtf);
      else if (inflated.length !== 1 || inflated[0] !== 0) throw new Error(`Unsupported EasyWorship content in item ${index + 1}.`);
    } else if (content.toString('ascii', 0, 2) !== 'BM') {
      throw new Error(`Unsupported EasyWorship content in item ${index + 1}.`);
    }
    // Empty EasyWorship items contain only the one-byte compressed marker.
    if (text === '' && content[0] === 0x78) {
      items.push({ title: titles[index], kind: 'blank', slides: [{ name: '', text: '' }], image: null });
      continue;
    }
    block = blockAt(bytes, offset);
    offset = block.next;
    if (block.data[0] !== 0xff || block.data[1] !== 0xd8 || block.data.at(-2) !== 0xff || block.data.at(-1) !== 0xd9) {
      throw new Error(`The image for EasyWorship item ${index + 1} is invalid.`);
    }
    const slides = text ? parseLyrics(text).slides : [];
    items.push({ title: titles[index], kind: slides.length ? 'text' : titles[index].toLowerCase() === 'blank' ? 'blank' : 'image', slides, image: block.data });
  }
  if (offset !== bytes.length) throw new Error('The EasyWorship schedule contains unrecognized trailing data.');
  return { version: 5, items };
}
