import test from 'node:test';
import assert from 'node:assert/strict';
import { requiresVideoTranscode, wmvTranscodeArgs } from '../server/media-transcode.js';

test('WMV files require conversion regardless of extension casing',()=>{
  assert.equal(requiresVideoTranscode('service-background.WMV'),true);
  assert.equal(requiresVideoTranscode('service-background.mp4'),false);
});

test('WMV conversion produces a browser-compatible H.264 MP4',()=>{
  const args=wmvTranscodeArgs('input.wmv','output.mp4');
  assert.deepEqual(args.slice(-1),['output.mp4']);
  assert.ok(args.includes('libx264'));
  assert.ok(args.includes('yuv420p'));
  assert.ok(args.includes('+faststart'));
  assert.ok(args.includes('aac'));
});
