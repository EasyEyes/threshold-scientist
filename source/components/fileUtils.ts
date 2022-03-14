import { getAllUserAcceptableFileExtensions } from "./constants";

/**
 * returns the substring after the last 'period' character in the file name
 * @param file
 * @returns file extension
 */
export const getFileExtensionFromFileName = (fileName: string): string => {
  const splitExt = fileName.split(".");
  if (splitExt.length === 1) return "";
  return splitExt[splitExt.length - 1].toLowerCase();
};

export const getFileExtension = (file: File): string => {
  return getFileExtensionFromFileName(file.name);
};

export const isAcceptableExtension = (ext: string) => {
  return getAllUserAcceptableFileExtensions().includes(ext);
};

/* -------------------------------------------------------------------------- */

/**
 * @param file
 * @returns file string content UTF-8 format
 */
export const getFileTextData = (file: File): Promise<string> => {
  return new Promise<string>((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = (e: any) => {
      resolve(e.target.result);
    };

    fileReader.onerror = (e: any) => {
      console.error("Unable to get TEXT data", file, e);
    };

    fileReader.readAsText(file, "UTF-8");
  });
};

/**
 * @param file
 * @returns file string content base64 format
 */
export const getBase64Data = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);

    fileReader.onload = () => {
      if (
        typeof fileReader.result === "string" &&
        fileReader!.result!.includes(";base64,")
      ) {
        const splitResult = fileReader!.result!.split(";base64,");
        resolve(splitResult![1]);
      } else resolve(<string>fileReader.result);
    };

    fileReader.onerror = (e: any) => {
      console.error("Unable to get BINARY data", file, e);
    };
  });
};
