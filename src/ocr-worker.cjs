global.fetch = async () => {
  throw Error("OCR local: acceso de red desactivado.");
};
require("tesseract.js/src/worker-script/node/index.js");
