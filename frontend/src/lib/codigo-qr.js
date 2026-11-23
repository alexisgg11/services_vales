import QRCode from "qrcode";
export function crearQr(url) {
  const matrix = QRCode.create(url, { errorCorrectionLevel: "M" }).modules;
  return {
    getModuleCount: () => matrix.size,
    isDark: (row, column) => Boolean(matrix.data[row * matrix.size + column]),
  };
}
