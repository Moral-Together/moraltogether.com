#!/usr/bin/env node
// Re-encodes the partner logo videos to the size they are actually shown at, and reports what
// each one saved. Needs ffmpeg on the machine; it is a local tool, not part of any build —
// the site itself stays dependency-free.
//
//   node tools/compress-media.mjs --dry     measure without touching anything
//   node tools/compress-media.mjs           re-encode in place
//
// The originals stay in git history, so replacing them here is safe.
//
// Why 640 px: the logos render at 273×150 CSS pixels, so 640 covers a 2× screen with room to
// spare. Why CRF 30: at this size the difference from the source is invisible while the files
// come down by roughly nine tenths. Audio is dropped — these are silent animations, and a muted
// track only adds bytes.

import { readdirSync, statSync, renameSync, unlinkSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const WIDTH = 640;
const CRF = 30;
const DIR = 'images';
const dry = process.argv.includes('--dry');

function ffprobe(file, entries) {
    return execFileSync('ffprobe', [
        '-v', 'error', '-select_streams', 'v:0',
        '-show_entries', entries, '-of', 'default=noprint_wrappers=1:nokey=1', file,
    ]).toString().trim().split('\n');
}

// Partner logos only. shabbat-loop.mp4 is a full-screen background and is already encoded for
// that job — running it through this would shrink it to a sixth of the width it is shown at.
const videos = readdirSync(DIR).filter(f => /^p\d+.*\.mp4$/.test(f)).sort();
if (!videos.length) {
    console.error('no videos in ' + DIR);
    process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'mt-video-'));
let before = 0;
let after = 0;
const rows = [];

for (const name of videos) {
    const src = join(DIR, name);
    const out = join(work, name);
    const [width, height, duration] = ffprobe(src, 'stream=width,height:format=duration');

    execFileSync('ffmpeg', [
        '-y', '-v', 'error', '-i', src,
        '-an',
        '-vf', `scale='min(${WIDTH},iw)':-2:flags=lanczos`,
        '-c:v', 'libx264', '-crf', String(CRF), '-preset', 'slow',
        '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        out,
    ]);

    const wasBytes = statSync(src).size;
    const nowBytes = statSync(out).size;
    before += wasBytes;
    after += nowBytes;
    rows.push({ name, width, height, duration: Number(duration), wasBytes, nowBytes });

    if (!dry) {
        renameSync(out, src);
    } else {
        unlinkSync(out);
    }
}

const mb = b => (b / 1048576).toFixed(2).padStart(6);
console.log(`${'file'.padEnd(18)} ${'source'.padEnd(12)} ${'was'} → ${'now'}   saved`);
for (const r of rows) {
    const saved = Math.round(100 - (100 * r.nowBytes) / r.wasBytes);
    console.log(`${r.name.padEnd(18)} ${(r.width + '×' + r.height).padEnd(12)} ${mb(r.wasBytes)} → ${mb(r.nowBytes)} МБ  −${String(saved).padStart(2)}%`);
}
console.log(`${'—'.repeat(58)}\n${'total'.padEnd(31)} ${mb(before)} → ${mb(after)} МБ  −${Math.round(100 - (100 * after) / before)}%`);
if (dry) console.log('\n--dry: nothing was written');
