import formato from "../../shared/formato.js";
import iconos from "./iconos-pdf.js";
import { crearQr } from "../../shared/codigo-qr.js";

// One comparative composition feeds the preview, print and downloaded PDF.
export const renderizarPdf = async (m, v, qrUrl) => {
  const { PDFDocument, rgb } = PDFLib, doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = await doc.embedFont(globalThis.ValesPDFFontData, { subset: true });
  // Explicit colors and white paper keep the document independent of UI theme.
  const ink = rgb(39 / 255, 57 / 255, 69 / 255),
    muted = rgb(88 / 255, 107 / 255, 118 / 255),
    teal = rgb(22 / 255, 123 / 255, 118 / 255),
    line = rgb(221 / 255, 229 / 255, 231 / 255), white = rgb(1, 1, 1);
  const width = 595.28, height = 841.89, margin = 44,
    usable = width - margin * 2, gutter = 24;
  let page, y;
  const clean = (value) => String(value ?? "—")
    .replaceAll("\u202f", " ").replace(/[\u2010-\u2015]/g, "-");
  const textWidth = (value, size) => regular.widthOfTextAtSize(clean(value), size);
  const text = (value, x, at, { size = 10.4, color = ink } = {}) =>
    page.drawText(clean(value), { x, y: at, size, font: regular, color });
  const right = (value, at, { size = 10.4, color = ink, end = width - margin } = {}) =>
    text(value, end - textWidth(value, size), at, { size, color });
  const rule = (at, start = margin, end = width - margin) => page.drawLine({
    start: { x: start, y: at }, end: { x: end, y: at }, thickness: 0.6, color: line,
  });
  const wrap = (value, max, size = 10.4) => {
    const lines = [];
    for (const paragraph of clean(value).split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        if (textWidth((current ? current + " " : "") + word, size) <= max) {
          current += (current ? " " : "") + word;
          continue;
        }
        if (current) lines.push(current);
        current = "";
        for (const c of word) {
          if (textWidth(current + c, size) > max) {
            lines.push(current); current = "";
          }
          current += c;
        }
      }
      lines.push(current);
    }
    return lines;
  };
  const icon = (name, x, top, size = 11, color = muted) =>
    iconos.draw(page, name, x, top, size, color);
  const header = () => {
    page = doc.addPage([width, height]);
    page.drawRectangle({ x: 0, y: 0, width, height, color: white });
    const top = height - margin;
    icon("fuel", margin, top - 8, 25, teal);
    text("Vales", margin + 34, top - 20, { size: 19 });
    text("Control de combustible", margin + 34, top - 35, { size: 8.3, color: muted });
    right("Vale de combustible", top - 17, { size: 17.5 });
    right("Número " + m.code, top - 35, { size: 10.3 });
    const labelWidth = textWidth(m.state, 8.4) + 16,
      stateInk = v.state === 4 ? rgb(0.63, 0.24, 0.29)
        : v.state === 0 ? rgb(0.53, 0.35, 0.1) : rgb(0.26, 0.41, 0.4),
      stateFill = v.state === 4 ? rgb(0.99, 0.94, 0.95)
        : v.state === 0 ? rgb(1, 0.96, 0.88) : rgb(0.93, 0.96, 0.95);
    page.drawRectangle({ x: width - margin - labelWidth, y: top - 59,
      width: labelWidth, height: 17, color: stateFill });
    text(m.state, width - margin - labelWidth + 8, top - 54, { size: 8.4, color: stateInk });
    rule(top - 76);
    y = top - 100;
  };
  const ensure = (space) => { if (y - space < margin) header(); };
  const grid = (items, { size = 10.4, space = 39, icons = [] } = {}) => {
    const cellWidth = (usable - gutter) / 2;
    for (let i = 0; i < items.length; i += 2) {
      const row = items.slice(i, i + 2),
        blocks = row.map(([, value]) => wrap(value, cellWidth, size)),
        rowHeight = Math.max(space, 17 + Math.max(...blocks.map(a => a.length)) * 12 + 8);
      ensure(rowHeight);
      row.forEach(([label], j) => {
        const x = margin + j * (cellWidth + gutter), name = icons[i + j];
        if (name) icon(name, x, y + 7);
        text(label, x + (name ? 16 : 0), y, { size: 8.6, color: muted });
        blocks[j].forEach((t, k) => text(t, x, y - 15 - k * 12, { size }));
      });
      y -= rowHeight;
    }
  };
  const comparison = () => {
    const tableHeight = 29 + m.comparison.length * 39;
    ensure(26 + tableHeight + (m.consumption.length ? 57 : 30));
    text("Emisión y atención", margin, y, { size: 11.4 });
    const supplyWidth = textWidth(m.supply, 10.8);
    icon("droplet", width - margin - supplyWidth - 17, y + 10, 11, teal);
    right(m.supply, y, { size: 10.8, color: teal });
    y -= 26;
    const ends = [margin + usable * 0.53, margin + usable * 0.76, width - margin - 7];
    text("Etapa", margin, y, { size: 8.7, color: muted });
    ["Cantidad", "Precio", "Importe"].forEach((label, i) => {
      right(label, y, { size: 8.7, color: muted, end: ends[i] });
      right(["(gal)", "(S/ por gal)", "(S/)"][i], y - 12,
        { size: 8.3, color: muted, end: ends[i] });
    });
    rule(y - 22);
    y -= 42;
    for (const row of m.comparison) {
      text(row.stage, margin, y, { size: 10.4, color: ink });
      [row.quantity, row.price, row.amount].forEach((value, i) =>
        right(value, y, { size: 10.4, color: ink, end: ends[i] }));
      if (row.estimated) right("estimado", y - 11, { size: 8, color: muted, end: ends[2] });
      rule(y - 21);
      y -= 39;
    }
    if (m.consumption.length) {
      y -= 1;
      grid(m.consumption.slice(0, 2), { icons: ["calendar-days", "receipt"], space: 43 });
    } else {
      text("Sin atención registrada", margin, y, { size: 8.7, color: muted });
      y -= 27;
    }
  };
  const observation = () => {
    ensure(38);
    text("Observación", margin, y, { size: 8.6, color: muted });
    y -= 16;
    for (const t of wrap(m.note, usable, 10)) {
      if (y - 14 < margin) {
        header();
        text("Observación (continuación)", margin, y, { size: 8.6, color: muted });
        y -= 16;
      }
      text(t, margin, y, { size: 10 });
      y -= 14;
    }
    y -= 18;
  };
  const footer = () => {
    const qrSize = 128,
      actorStart = margin + qrSize + 19,
      actorWidth = (usable - qrSize - 19) / m.actors.length,
      actorBlocks = m.actors.map(([label, person, date]) => {
        const lines = [];
        let offset = 0;
        const add = (value, size, color, leading) => {
          wrap(value, actorWidth - 10, size).forEach(value => {
            lines.push({ value, size, color, offset });
            offset -= leading;
          });
        };
        add(label, 8.1, muted, 11);
        offset -= 6;
        add(person?.name || "Sin registro", 9.3, ink, 12);
        offset -= 2;
        if (person?.role) add(person.role, 8, muted, 11);
        if (date) {
          offset -= 3;
          add(formato.date(date), 8, muted, 11);
        }
        return lines;
      }),
      ascent = size => regular.heightAtSize(size, { descender: false }),
      descent = size => regular.heightAtSize(size) - ascent(size),
      actorTop = Math.max(...actorBlocks.flat().map(l => l.offset + ascent(l.size))),
      actorBottom = Math.min(...actorBlocks.flat().map(l => l.offset - descent(l.size))),
      actorHeight = actorTop - actorBottom,
      footerHeight = Math.max(qrSize + 23, actorHeight + 12);
    ensure(footerHeight + 12);
    // Bottom alignment keeps a clear gap after observations.
    const top = margin + footerHeight;
    rule(top + 12);
    const left = margin, bottom = top - qrSize, code = crearQr(qrUrl);
    page.drawRectangle({ x: left, y: bottom, width: qrSize, height: qrSize,
      color: white, borderColor: line, borderWidth: 0.6 });
    if (code) {
      const count = code.getModuleCount(), unit = qrSize / (count + 8);
      for (let row = 0; row < count; row++)
        for (let col = 0; col < count; col++)
          if (code.isDark(row, col)) page.drawRectangle({
            x: left + (col + 4) * unit,
            y: bottom + qrSize - (row + 5) * unit,
            width: unit + 0.01, height: unit + 0.01, color: rgb(0, 0, 0),
          });
    } else icon("qr-code", left + 48, top - 48, 32, muted);
    const caption = "Escanea para consultar el vale";
    wrap(caption, qrSize, 7.6).forEach((t, i) =>
      text(t, left + (qrSize - textWidth(t, 7.6)) / 2, bottom - 14 - i * 10,
        { size: 7.6, color: muted }));
    // Center the complete row of responsible people against the QR square.
    const actorBaseline = top - qrSize / 2 - (actorTop + actorBottom) / 2;
    actorBlocks.forEach((lines, i) => {
      const x = actorStart + i * actorWidth;
      lines.forEach(l => text(l.value, x, actorBaseline + l.offset,
        { size: l.size, color: l.color }));
    });
  };
  header();
  grid(m.info);
  y -= 3;
  comparison();
  if (m.invoice) {
    ensure(33);
    text("Factura asociada", margin, y, { size: 8.6, color: muted });
    right(m.invoice, y, { size: 10.4 });
    y -= 29;
  }
  observation();
  footer();
  doc.setTitle("Vale " + formato.reference(v));
  doc.setAuthor("Vales");
  doc.setSubject("Vale de combustible");
  doc.setLanguage("es-PE");
  return doc.save();
};
