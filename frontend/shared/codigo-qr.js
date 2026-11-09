export function crearQr(url) {
  const codigo = qrcode(0, "M");
  codigo.addData(url);
  codigo.make();
  return codigo;
}
