// The studio bundles the example experiment tables as text (webpack rule:
// `.csv` → asset/source in webpack.config.js).
declare module "*.csv" {
  const contents: string;
  export default contents;
}
