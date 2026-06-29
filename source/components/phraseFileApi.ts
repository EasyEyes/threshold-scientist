import { getEasyEyesBaseUrl } from "../../threshold/components/easyeyesBaseUrl";

export async function translatePhraseFileApi(file: File): Promise<File> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++)
    binary += String.fromCharCode(bytes[i]);
  const fileBase64 = btoa(binary);

  const url = `${await getEasyEyesBaseUrl()}/.netlify/functions/translate-phrase-file`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileBase64 }),
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: "Translation failed" }));
    throw new Error((err as { error?: string }).error ?? "Translation failed");
  }

  const { fileBase64: outBase64 } = (await response.json()) as {
    fileBase64: string;
  };
  const outBinary = atob(outBase64);
  const outBytes = new Uint8Array(outBinary.length);
  for (let i = 0; i < outBinary.length; i++)
    outBytes[i] = outBinary.charCodeAt(i);
  return new File([outBytes], file.name, { type: file.type });
}
