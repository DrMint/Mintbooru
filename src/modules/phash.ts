// From: https://github.com/btd/sharp-phash
// MIT License
// Copyright (c) 2016 Denis Bardadym

import type { Sharp } from "sharp";

const SAMPLE_SIZE = 32;
const LOW_SIZE = 8;

// Init SQRT
const SQRT = new Array<number>(SAMPLE_SIZE);
for (let i = 1; i < SAMPLE_SIZE; i++) {
  SQRT[i] = 1;
}
SQRT[0] = 1 / Math.sqrt(2.0);

// Init COS
const COS = new Array<Array<number>>(SAMPLE_SIZE);
for (let k = 0; k < SAMPLE_SIZE; k++) {
  COS[k] = new Array(SAMPLE_SIZE);
  for (let n = 0; n < SAMPLE_SIZE; n++) {
    COS[k][n] = Math.cos(((2 * k + 1) / (2.0 * SAMPLE_SIZE)) * n * Math.PI);
  }
}

const applyDCT = (f: number[][], size: number): number[][] => {
  var N = size;

  var F = new Array<Array<number>>(N);
  for (var u = 0; u < N; u++) {
    F[u] = new Array<number>(N);
    for (var v = 0; v < N; v++) {
      var sum = 0;
      for (var i = 0; i < N; i++) {
        for (var j = 0; j < N; j++) {
          sum += COS[i][u] * COS[j][v] * f[i][j];
        }
      }
      sum *= (SQRT[u] * SQRT[v]) / 4;
      F[u][v] = sum;
    }
  }
  return F;
};

export const phash = async (image: Sharp) => {
  const clone = image
    .clone()
    .greyscale()
    .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "fill" })
    .rotate()
    .raw();

  const data = await clone.toBuffer();
  clone.destroy();

  // copy signal
  const s = new Array<Array<number>>(SAMPLE_SIZE);
  for (let x = 0; x < SAMPLE_SIZE; x++) {
    s[x] = new Array<number>(SAMPLE_SIZE);
    for (let y = 0; y < SAMPLE_SIZE; y++) {
      s[x][y] = data[SAMPLE_SIZE * y + x];
    }
  }

  // apply 2D DCT II
  const dct = applyDCT(s, SAMPLE_SIZE);

  // get AVG on high frequencies
  let totalSum = 0;
  for (let x = 0; x < LOW_SIZE; x++) {
    for (let y = 0; y < LOW_SIZE; y++) {
      totalSum += dct[x + 1][y + 1];
    }
  }

  const avg = totalSum / (LOW_SIZE * LOW_SIZE);

  // compute hash
  let fingerprint = "";

  for (let x = 0; x < LOW_SIZE; x++) {
    for (let y = 0; y < LOW_SIZE; y++) {
      fingerprint += dct[x + 1][y + 1] > avg ? "1" : "0";
    }
  }

  return fingerprint;
};

export const hashDistance = (a: string, b: string): number => {
  let count = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      count++;
    }
  }
  return count;
};
