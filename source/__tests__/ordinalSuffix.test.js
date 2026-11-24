// ordinalSuffixOf (source/components/utils.ts): the English ordinal ending
// used in the compiler's hints ("the 2nd value is nonsequential").
import { ordinalSuffixOf } from "../components/utils";

/** Reference: the usual English rule, for non-negative integers. */
const reference = (i) => {
  const n = i % 100;
  if (n >= 11 && n <= 13) return "th";
  return ["th", "st", "nd", "rd"][i % 10] ?? "th";
};

describe("ordinalSuffixOf", () => {
  it.each([
    [0, "0th"],
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [10, "10th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [14, "14th"],
    [20, "20th"],
    [21, "21st"],
    [22, "22nd"],
    [23, "23rd"],
    [101, "101st"],
    [111, "111th"],
    [112, "112th"],
    [113, "113th"],
    [121, "121st"],
    [123, "123rd"],
  ])("%i → %s", (i, expected) => {
    expect(ordinalSuffixOf(i)).toBe(expected);
  });

  it("keeps the number in the result and matches the English rule throughout", () => {
    for (let i = 0; i < 1000; i++) {
      const suffix = ordinalSuffixOf(i);
      expect(suffix.startsWith(String(i))).toBe(true);
      expect(suffix).toBe(i + reference(i));
    }
    expect(typeof ordinalSuffixOf(7)).toBe("string");
  });
});
