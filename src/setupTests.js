// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// recharts の ResponsiveContainer が要求するが jsdom には無いので、何もしない実装を置く。
// グラフの描画自体はテスト対象にしていない（サイズが 0 なので線は出ない）。
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
