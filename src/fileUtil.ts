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

    fileReader.onload = (e: any) => {
      if (
        typeof fileReader.result === "string" &&
        fileReader!.result!.includes(";base64,")
      ) {
        var splitResult = fileReader!.result!.split(";base64,");
        resolve(splitResult![1]);
      } else resolve(<string>fileReader.result);
    };

    fileReader.onerror = (e: any) => {
      console.error("Unable to get BINARY data", file, e);
    };
  });
};

/**
 * returns the substring after the last 'period' character in the file name
 * @param file
 * @returns file extension
 */
export const getFileExtension = (file: File): string => {
  let splitExt = file.name.split(".");
  return splitExt[splitExt.length - 1].toLowerCase();
};
