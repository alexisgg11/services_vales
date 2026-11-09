// Reuse Lucide's vector geometry in PDF rather than a separate icon set.
export default {
  draw(page, name, x, top, size, color) {
    const key = name
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("");
    const shapes = lucide.icons[key];
    if (!shapes) throw Error("Icono PDF desconocido: " + name);
    const scale = size / 24,
      stroke = 1.7 * scale;
    for (const [tag, a] of shapes) {
      if (tag === "path")
        page.drawSvgPath(a.d, {
          x,
          y: top,
          scale,
          borderColor: color,
          borderWidth: 1.7,
          borderLineCap: PDFLib.LineCapStyle.Round,
        });
      else if (tag === "circle")
        page.drawCircle({
          x: x + Number(a.cx) * scale,
          y: top - Number(a.cy) * scale,
          size: Number(a.r) * scale,
          borderColor: color,
          borderWidth: stroke,
        });
      else if (tag === "rect")
        page.drawRectangle({
          x: x + Number(a.x || 0) * scale,
          y: top - (Number(a.y || 0) + Number(a.height)) * scale,
          width: Number(a.width) * scale,
          height: Number(a.height) * scale,
          borderColor: color,
          borderWidth: stroke,
        });
      else if (tag === "line")
        page.drawLine({
          start: { x: x + Number(a.x1) * scale, y: top - Number(a.y1) * scale },
          end: { x: x + Number(a.x2) * scale, y: top - Number(a.y2) * scale },
          color,
          thickness: stroke,
          lineCap: PDFLib.LineCapStyle.Round,
        });
      else throw Error("Geometría de icono PDF no soportada: " + tag);
    }
  },
};
