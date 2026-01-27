// Jest setup file for additional configuration

// Import jest-dom for custom matchers
import "@testing-library/jest-dom";

// Mock CSS modules
global.CSS = { supports: () => false };

// Suppress harmless act() warnings from async lifecycle methods in class components
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    const message = typeof args[0] === "string" ? args[0] : args[0]?.toString();
    if (
      message &&
      message.includes("An update to") &&
      message.includes("inside a test was not wrapped in act")
    ) {
      return; // Suppress known harmless warning from async componentDidMount
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Add any global test setup here
