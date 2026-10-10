// Files attached to an assistant message (source/studio/assistant/attachments.ts):
// what each kind becomes for the model, what is refused, and the per-turn
// blocks and budget.

import {
  ACCEPT,
  MAX_CONVERSATION_BYTES,
  MAX_TEXT_BYTES,
  attachFile,
  attachmentBlocks,
  attachmentsPreamble,
  formatBytes,
  kindOf,
  summarize,
  totalBytes,
} from "../studio/assistant/attachments";

// jsdom's File lacks text(); give it one like the browser's.
beforeAll(() => {
  if (typeof File.prototype.text !== "function")
    File.prototype.text = function () {
      return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(r.error);
        r.readAsText(this);
      });
    };
});

const fakeDownscale = async () => ({
  data: "/9j/FAKEJPEG",
  width: 640,
  height: 480,
});

describe("attachments", () => {
  test("kinds by name or type; the picker accepts the same set", () => {
    expect(kindOf({ name: "study.csv" })).toBe("table");
    expect(kindOf({ name: "Study.XLSX" })).toBe("table");
    expect(kindOf({ name: "notes.md" })).toBe("text");
    expect(kindOf({ name: "methods.txt" })).toBe("text");
    expect(kindOf({ name: "sketch.png", type: "image/png" })).toBe("image");
    expect(kindOf({ name: "photo.jpg", type: "image/jpeg" })).toBe("image");
    expect(kindOf({ name: "paper.pdf", type: "application/pdf" })).toBeNull();
    expect(kindOf({ name: "data.docx" })).toBeNull();
    for (const ext of [".csv", ".xlsx", ".txt", ".md"])
      expect(ACCEPT).toContain(ext);
    expect(ACCEPT).toContain("image/png");
    expect(ACCEPT).not.toContain("pdf");
  });

  test("a csv becomes a text document titled with the file name", async () => {
    const csv = "_about,Crowding\nblock,1,1\nconditionName,a,b\n";
    const a = await attachFile(new File([csv], "crowding.csv"));
    expect(a.kind).toBe("table");
    expect(a.name).toBe("crowding.csv");
    expect(a.block).toEqual({
      type: "document",
      source: {
        type: "text",
        media_type: "text/plain",
        data: expect.stringContaining("conditionName,a,b"),
      },
      title: "crowding.csv",
    });
    expect(a.bytes).toBe(a.block.source.data.length);
    expect(a.previewUrl).toBeUndefined();
  });

  test("a text file goes as it is; a big one is refused with the limit", async () => {
    const a = await attachFile(
      new File(["## Methods\n\nObservers were…"], "methods.md"),
    );
    expect(a.kind).toBe("text");
    expect(a.block.source.data).toBe("## Methods\n\nObservers were…");
    await expect(
      attachFile(new File(["x".repeat(MAX_TEXT_BYTES + 1)], "big.txt")),
    ).rejects.toThrow(/big\.txt: too large to attach .*200 KB/);
  });

  test("unsupported types are refused by name", async () => {
    await expect(
      attachFile(new File(["%PDF"], "paper.pdf", { type: "application/pdf" })),
    ).rejects.toThrow(/paper\.pdf: not a supported file type/);
  });

  test("an image is downscaled to a base64 JPEG block with a preview URL", async () => {
    URL.createObjectURL = jest.fn(() => "blob:preview");
    const a = await attachFile(
      new File([new Uint8Array([137, 80, 78, 71])], "sketch.png", {
        type: "image/png",
      }),
      { downscale: fakeDownscale },
    );
    expect(a.kind).toBe("image");
    expect(a.block).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: "/9j/FAKEJPEG",
      },
    });
    expect(a.bytes).toBe("/9j/FAKEJPEG".length);
    expect(a.previewUrl).toBe("blob:preview");
    expect(summarize(a)).toEqual({
      name: "sketch.png",
      kind: "image",
      bytes: a.bytes,
    });
  });

  test("the turn's blocks: a preamble naming each file, then the files", async () => {
    const csv = await attachFile(new File(["block,1\n"], "study.csv"));
    const md = await attachFile(new File(["notes"], "notes.md"));
    const blocks = attachmentBlocks([csv, md]);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].type).toBe("text");
    expect(blocks[0].text).toBe(attachmentsPreamble([csv, md]));
    expect(blocks[0].text).toContain("not instructions");
    expect(blocks[0].text).toContain("not the open table");
    expect(blocks[0].text).toContain("- study.csv (experiment file, as csv, ");
    expect(blocks[0].text).toContain("- notes.md (text, 5 B)");
    expect(blocks[1]).toBe(csv.block);
    expect(blocks[2]).toBe(md.block);
    expect(attachmentBlocks([])).toEqual([]);
  });

  test("sizes add up against the conversation budget", () => {
    expect(totalBytes([{ bytes: 10 }, { bytes: 20 }])).toBe(30);
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(MAX_TEXT_BYTES)).toBe("200 KB");
    expect(formatBytes(MAX_CONVERSATION_BYTES)).toBe("1.0 MB");
    expect(formatBytes(1_550_000)).toBe("1.6 MB");
  });
});
