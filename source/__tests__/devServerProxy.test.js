const ORIGINAL_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const ORIGINAL_PROXY_TARGET = process.env.NETLIFY_PROXY_TARGET;

beforeEach(() => {
  jest.resetModules();
  process.env.FIREBASE_DATABASE_URL =
    "https://test-local-default-rtdb.firebaseio.com";
  delete process.env.NETLIFY_PROXY_TARGET;
});

afterEach(() => {
  if (ORIGINAL_DATABASE_URL === undefined)
    delete process.env.FIREBASE_DATABASE_URL;
  else process.env.FIREBASE_DATABASE_URL = ORIGINAL_DATABASE_URL;
  if (ORIGINAL_PROXY_TARGET === undefined)
    delete process.env.NETLIFY_PROXY_TARGET;
  else process.env.NETLIFY_PROXY_TARGET = ORIGINAL_PROXY_TARGET;
});

const developmentConfig = () =>
  require("../../webpack.config")({ development: true });

test("development server proxies Netlify functions to the deployed backend", () => {
  const config = developmentConfig();
  expect(config.devServer.proxy).toEqual([
    expect.objectContaining({
      context: ["/.netlify/functions/study-phrase-analysis"],
      target: "http://localhost:8888",
      changeOrigin: true,
      secure: true,
    }),
    expect.objectContaining({
      context: ["/.netlify/functions"],
      target: "https://easyeyes.app",
      changeOrigin: true,
      secure: true,
    }),
  ]);
});

test("development uses the public RTDB URL when FIREBASE_DATABASE_URL is unset", () => {
  process.env.FIREBASE_DATABASE_URL = "";
  const config = developmentConfig();
  const definePlugin = config.plugins.find(
    (plugin) => plugin.constructor.name === "DefinePlugin",
  );
  expect(definePlugin.definitions["process.env.FIREBASE_DATABASE_URL"]).toBe(
    JSON.stringify("https://easyeyes-compiler-default-rtdb.firebaseio.com"),
  );
});

test("development proxy honors NETLIFY_PROXY_TARGET", () => {
  process.env.NETLIFY_PROXY_TARGET = "http://localhost:8888";
  const config = developmentConfig();
  expect(config.devServer.proxy[1].target).toBe("http://localhost:8888");
});
