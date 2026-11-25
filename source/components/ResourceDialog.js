// The dialog that opens when a resource button (fonts, forms, images, ...) is
// clicked on the Compiler page.
//
// For resources that can be previewed (fonts, forms, images, texts) it is a
// split view: on the left the files, with a search field; on the right a
// preview of the file that is selected. A font is shown as sample text set in
// that font, an image as itself, a PDF in a frame, and a Markdown or text
// file as text.
//
// For resources that cannot be previewed (code, whose files are too large,
// phrases and sound files) there is no preview side at all: the
// dialog is just the search field and the list.
//
// The dialog knows nothing about Pavlovia. The caller passes `loadFile`, which
// returns the file's content as base64 (see resourcePreviewLoader.js). When
// `loadFile` is absent the dialog is the plain list.
import Swal from "sweetalert2";

const escapeHtml = (text) =>
  String(text).replace(/[<>"&]/g, (c) => `&#${c.charCodeAt(0)};`);

const extensionOf = (name) => {
  const match = /\.([A-Za-z0-9]+)$/.exec(name);
  return match ? match[1].toLowerCase() : "";
};

const MIME = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

// What kind of preview a file gets. `folder` is the resource folder it lives
// in ("fonts", "forms", ...); null means its content cannot be fetched.
export const previewKind = (folder, name) => {
  if (!folder) return "none";
  const ext = extensionOf(name);
  if (folder === "fonts")
    return ["woff", "woff2", "otf", "ttf"].includes(ext) ? "font" : "none";
  if (["png", "jpg", "jpeg", "svg"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["md", "txt"].includes(ext)) return "text";
  return "none";
};

const base64ToBytes = (base64) => {
  const binary = atob(base64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

// `selectable`: with a preview side each file is a button that selects it;
// without one the files are plain rows.
const buildListHTML = (groups, emptyText, selectable) => {
  const total = groups.reduce((sum, group) => sum + group.files.length, 0);
  // Groups without headings read as one list, so they share one message
  // when the whole list is empty.
  if (!total && groups.every((group) => !group.heading))
    return `<p class="resource-empty">${escapeHtml(emptyText)}</p>`;
  return groups
    .map((group, groupIndex) => {
      const heading = group.heading
        ? `<p class="resource-group-heading">${escapeHtml(group.heading)}</p>`
        : "";
      const rows = group.files.length
        ? group.files
            .map((file) => {
              const ext = extensionOf(file);
              const tag = selectable ? "button" : "div";
              return `<${tag} ${
                selectable ? 'type="button" ' : ""
              }class="resource-row${
                selectable ? "" : " resource-row-plain"
              }" data-group="${groupIndex}" data-name="${escapeHtml(file)}">
                <span class="resource-row-name">${escapeHtml(file)}</span>
                ${ext ? `<span class="resource-row-ext">${ext}</span>` : ""}
              </${tag}>`;
            })
            .join("")
        : group.emptyText
        ? `<p class="resource-empty resource-empty-group">${escapeHtml(
            group.emptyText,
          )}</p>`
        : "";
      return `<div class="resource-group">${heading}${rows}</div>`;
    })
    .join("");
};

/**
 * @param {object} options
 * @param {string} options.title Dialog title, e.g. "Fonts".
 * @param {{heading?: string, folder: string|null, files: string[], emptyText?: string}[]} options.groups
 *   A group's own `emptyText` is shown under its heading when it has no files.
 * @param {string} options.emptyText Shown when there are no files at all and
 *   no group has a heading.
 * @param {(folder: string, name: string) => Promise<string>} [options.loadFile]
 *   Returns the file's content as base64.
 */
export const openResourceDialog = ({ title, groups, emptyText, loadFile }) => {
  const cache = new Map(); // "folder/name" -> Promise<string base64>
  const objectUrls = [];
  const fontFaces = [];
  let current = null; // key of the file being shown; guards against late loads
  const withPreview = !!loadFile;

  void Swal.fire({
    title,
    width: withPreview ? "960px" : "520px",
    confirmButtonColor: "#019267",
    customClass: {
      htmlContainer: "resource-modal-html-container",
      popup: "resource-modal-popup",
    },
    html: `
      <div class="resource-dialog${
        withPreview ? "" : " resource-dialog-list-only"
      }">
        <div class="resource-list-pane">
          <input type="text" id="resource-search" class="swal2-input resource-search-input" placeholder="Search files..." />
          <div class="resource-list" id="resource-list">${buildListHTML(
            groups,
            emptyText,
            withPreview,
          )}</div>
        </div>
        ${
          withPreview
            ? `<div class="resource-preview-pane" id="resource-preview" aria-live="polite">
          <p class="resource-preview-hint">Select a file to preview it.</p>
        </div>`
            : ""
        }
      </div>`,
    // Tidy up when the dialog has closed: forget the previewed fonts and
    // release the PDF blobs.
    didClose: () => {
      current = null;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      fontFaces.forEach((face) => document.fonts.delete(face));
    },
    didOpen: (popup) => {
      const list = popup.querySelector("#resource-list");
      const preview = popup.querySelector("#resource-preview");
      const search = popup.querySelector("#resource-search");
      const rows = Array.from(list.querySelectorAll(".resource-row"));

      const showMessage = (name, message) => {
        preview.classList.remove("resource-preview-pdf");
        preview.innerHTML = `
          <p class="resource-preview-name">${escapeHtml(name)}</p>
          <p class="resource-preview-hint">${escapeHtml(message)}</p>`;
      };

      const render = async (folder, name, kind, base64) => {
        const header = `<p class="resource-preview-name">${escapeHtml(
          name,
        )}</p>`;
        const ext = extensionOf(name);
        preview.classList.toggle("resource-preview-pdf", kind === "pdf");
        if (kind === "image") {
          preview.innerHTML = `${header}<img class="resource-preview-image" alt="" src="data:${
            MIME[ext]
          };base64,${base64.replace(/\s/g, "")}" />`;
        } else if (kind === "pdf") {
          const url = URL.createObjectURL(
            new Blob([base64ToBytes(base64)], { type: MIME.pdf }),
          );
          objectUrls.push(url);
          // The browser's own PDF viewer, without its toolbar and side panel
          // and with the page fitted to the width of the frame, so the
          // document fills the preview and is large enough to read.
          preview.innerHTML = `${header}<iframe class="resource-preview-frame" title="${escapeHtml(
            name,
          )}" src="${url}#toolbar=0&navpanes=0&view=FitH"></iframe>`;
        } else if (kind === "text") {
          const text = new TextDecoder().decode(base64ToBytes(base64));
          preview.innerHTML = `${header}<pre class="resource-preview-text">${escapeHtml(
            text.length > 20000 ? `${text.slice(0, 20000)}\n…` : text,
          )}</pre>`;
        } else if (kind === "font") {
          const family = `easyeyes-preview-${fontFaces.length}`;
          const face = new FontFace(family, base64ToBytes(base64).buffer);
          await face.load();
          document.fonts.add(face);
          fontFaces.push(face);
          preview.innerHTML = `${header}
            <div class="resource-font-sample" style="font-family: '${family}', sans-serif">
              <p class="resource-font-big">Aa</p>
              <p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
              <p>abcdefghijklmnopqrstuvwxyz</p>
              <p>0123456789</p>
              <p>The quick brown fox jumps over the lazy dog.</p>
            </div>`;
        }
      };

      const select = async (row) => {
        rows.forEach((r) => r.classList.toggle("is-selected", r === row));
        const group = groups[Number(row.getAttribute("data-group"))];
        const name = row.getAttribute("data-name");
        const kind = previewKind(group.folder, name);
        const key = `${group.folder}/${name}`;
        current = key;

        if (kind === "none") {
          showMessage(name, "No preview for this kind of file.");
          return;
        }
        preview.classList.remove("resource-preview-pdf");
        preview.innerHTML = `
          <p class="resource-preview-name">${escapeHtml(name)}</p>
          <p class="resource-preview-hint"><i class="bi bi-arrow-repeat icon-spin"></i></p>`;
        try {
          if (!cache.has(key)) cache.set(key, loadFile(group.folder, name));
          const base64 = await cache.get(key);
          if (current !== key) return; // another file was chosen meanwhile
          await render(group.folder, name, kind, base64);
        } catch (error) {
          cache.delete(key);
          if (current === key)
            showMessage(name, "This file could not be loaded.");
        }
      };

      if (withPreview)
        rows.forEach((row) =>
          row.addEventListener("click", () => void select(row)),
        );

      search.addEventListener("input", () => {
        const term = search.value.trim().toLowerCase();
        rows.forEach((row) => {
          const name = row.getAttribute("data-name").toLowerCase();
          row.hidden = !!term && !name.includes(term);
        });
      });

      // Open on the first file that has a preview, so the right side is not
      // empty when there is something to show.
      const first = rows.find(
        (row) =>
          previewKind(
            groups[Number(row.getAttribute("data-group"))].folder,
            row.getAttribute("data-name"),
          ) !== "none",
      );
      if (first && withPreview) void select(first);
      search.focus();
    },
  });
};
