import { describe, it, expect } from 'vitest';
import { clampQuantity } from './quantity';

describe('clampQuantity', () => {
  it('parses period as decimal separator', () => {
    expect(clampQuantity('2.5')).toBe(2.5);
  });

  it('parses comma as decimal separator', () => {
    expect(clampQuantity('2,5')).toBe(2.5);
  });

  it('accepts comma without period as decimal', () => {
    expect(clampQuantity('0,5')).toBe(0.5);
  });

  it('clamps values below 0.1 to 1', () => {
    expect(clampQuantity('0,05')).toBe(1);
  });

  it('clamps values above 9999', () => {
    expect(clampQuantity('10000')).toBe(9999);
  });

  it('clamps negative comma values to 1', () => {
    expect(clampQuantity('-1,5')).toBe(1);
  });

  it('returns 1 for empty string', () => {
    expect(clampQuantity('')).toBe(1);
  });

  it('returns 1 for non-numeric input', () => {
    expect(clampQuantity('abc')).toBe(1);
  });

  it('handles pure comma string', () => {
    expect(clampQuantity(',')).toBe(1);
  });

  it('handles trailing comma', () => {
    expect(clampQuantity('2,')).toBe(2);  // parseFloat('2.') = 2
  });

  it('handles integer input unchanged', () => {
    expect(clampQuantity('5')).toBe(5);
  });
});
