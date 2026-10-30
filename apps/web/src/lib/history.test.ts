import { describe, expect, it } from 'vitest';
import { createHistory, moveItem, push, redo, undo } from './history';

describe('undo/redo history', () => {
  it('undoes and redoes, and a new edit clears the redo stack', () => {
    let h = createHistory(1);
    h = push(h, 2);
    h = push(h, 3);
    h = undo(h);
    expect(h.present).toBe(2);
    h = redo(h);
    expect(h.present).toBe(3);
    h = undo(undo(h));
    expect(h.present).toBe(1);
    h = push(h, 9);
    expect(h.future).toEqual([]);
    expect(redo(h).present).toBe(9);
  });

  it('is bounded', () => {
    let h = createHistory(0);
    for (let i = 1; i <= 150; i++) h = push(h, i, 100);
    expect(h.past).toHaveLength(100);
  });

  it('moves items', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b']);
  });
});
