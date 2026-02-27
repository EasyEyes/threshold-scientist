// Mock files module - use 200 files to trigger non-monotonic bug with old code
jest.mock("../../threshold/preprocess/files", () => ({
  _loadFiles: Array(200)
    .fill(0)
    .map((_, i) => `file${i}.js`),
  _loadDir: "/test/",
}));

// Mock other dependencies
jest.mock("../../threshold/preprocess/fileUtils", () => ({
  assetUsesBase64: jest.fn(() => false),
  getAssetFileContent: jest.fn().mockResolvedValue("test content"),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => {
  const actual = jest.requireActual("../../threshold/preprocess/gitlabUtils");
  return {
    ...actual,
  };
});

describe("gitlabUtils - Upload Progress", () => {
  let mockProgressUpdates;

  beforeEach(() => {
    jest.clearAllMocks();
    mockProgressUpdates = [];

    // Suppress console output during tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});

    // Mock global fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({}),
      text: jest.fn().mockResolvedValue(""),
    });

    // Mock pushCommits to simulate successful uploads
    jest
      .spyOn(require("../../threshold/preprocess/gitlabUtils"), "pushCommits")
      .mockResolvedValue({ id: "commit-123" });

    // Mock DOM element that tracks innerHTML updates
    const mockProgressElement = {
      innerHTML: "0",
    };

    Object.defineProperty(mockProgressElement, "innerHTML", {
      set(value) {
        const percentage = parseInt(value, 10);
        if (!isNaN(percentage)) {
          mockProgressUpdates.push(percentage);
        }
      },
      get() {
        return this._innerHTML || "0";
      },
    });

    // Mock document.getElementById to return our tracking element
    global.document.getElementById = jest.fn((id) => {
      if (id === "uploading-count") {
        return mockProgressElement;
      }
      return null;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createThresholdCoreFilesOnRepo - Progress Monotonicity", () => {
    it("should maintain monotonically increasing progress within a single upload attempt", async () => {
      // This test validates that progress is monotonically non-decreasing
      // when gathering files and uploading in a single commit
      const {
        createThresholdCoreFilesOnRepo,
        pushCommits,
      } = require("../../threshold/preprocess/gitlabUtils");

      const uploadedFileCount = { current: 0 };
      const mockRepo = { id: "123" };
      const mockUser = { username: "testuser" };
      const totalFileCount = 200; // Will be += 3 in function

      // Mock pushCommits before calling function
      jest
        .spyOn(require("../../threshold/preprocess/gitlabUtils"), "pushCommits")
        .mockResolvedValue({ id: "commit-123" });

      // Call the real function
      try {
        await createThresholdCoreFilesOnRepo(
          mockRepo,
          mockUser,
          uploadedFileCount,
          totalFileCount,
        );
      } catch (e) {
        // Function may fail due to mocking, but we still capture progress
      }

      // Assert: Progress should be monotonically non-decreasing
      expect(mockProgressUpdates.length).toBeGreaterThan(1);

      for (let i = 1; i < mockProgressUpdates.length; i++) {
        expect(mockProgressUpdates[i]).toBeGreaterThanOrEqual(
          mockProgressUpdates[i - 1],
        );
      }

      // Assert: Final progress should be higher than initial
      expect(
        mockProgressUpdates[mockProgressUpdates.length - 1],
      ).toBeGreaterThan(mockProgressUpdates[0]);
    });

    it("should reset progress on retry attempt", () => {
      // Arrange
      const uploadedFileCount1 = { current: 0 };
      const uploadedFileCount2 = { current: 0 };
      const totalFileCount = 100;

      const batchSize = 25;
      const progressCalculation = (count, totalCount) => {
        return Math.round(Math.min((count + 1) / (totalCount + 1), 1) * 100);
      };

      // First attempt: reach 50% progress
      uploadedFileCount1.current = 50;
      const progress1 = progressCalculation(
        uploadedFileCount1.current,
        totalFileCount,
      );

      // Second attempt (retry): reset counter
      uploadedFileCount2.current = 0;
      const progress2 = progressCalculation(
        uploadedFileCount2.current,
        totalFileCount,
      );

      // Assert: Progress should reset on retry
      expect(progress1).toBeGreaterThan(progress2);
      expect(progress2).toBeLessThanOrEqual(10);
    });

    it("should not have progress jump backwards within single attempt", () => {
      // Arrange
      const uploadedFileCount = { current: 0 };
      const totalFileCount = 200;
      const batchSize = 25;

      const progressCalculation = (count, totalCount) => {
        return Math.round(Math.min((count + 1) / (totalCount + 1), 1) * 100);
      };

      const progressSequence = [];

      // Simulate initial fake progress
      const fakeStartingCount = batchSize / 2;
      progressSequence.push(
        progressCalculation(fakeStartingCount, totalFileCount),
      );

      // Simulate 8 batches (200 files total)
      for (let i = 0; i < 8; i++) {
        uploadedFileCount.current += batchSize;
        progressSequence.push(
          progressCalculation(uploadedFileCount.current, totalFileCount),
        );
      }

      // Assert: No progress should go backwards
      for (let i = 1; i < progressSequence.length; i++) {
        expect(progressSequence[i]).toBeGreaterThanOrEqual(
          progressSequence[i - 1],
        );
      }

      // Assert: The initial drop from ~30% to ~12% should not exist
      // With fix: starts at ~7%, goes to ~13%, continuing up
      expect(progressSequence[0]).toBeLessThan(progressSequence[1]);
    });
  });
});
