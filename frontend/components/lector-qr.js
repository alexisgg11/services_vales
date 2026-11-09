// Lector compartido por el panel y la ficha móvil.
export default (() => {
  const parse = (text) => {
    const value = text.trim();
    if (value.length > 2048) return null;
    try {
      const url = new URL(value);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
        return null;
      const id = /^\/vales\/q\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})\/?$/i.exec(url.pathname);
      if (id) return { idQr: id[1].toLowerCase() };
    } catch {
      return null;
    }
    return null;
  };

  function open({ resolve, onFound }) {
    const puedeTransmitir = window.isSecureContext && Boolean(navigator.mediaDevices?.getUserMedia);
    const instruccion = puedeTransmitir
      ? "Coloca el QR del vale frente a la cámara."
      : "Toma una foto donde se vea completo el QR.";
    const dialog = document.createElement("dialog");
    dialog.className = "lector-qr";
    dialog.setAttribute("aria-labelledby", "lector-qr-titulo");
    dialog.innerHTML = `
      <header class="lector-qr-cabecera">
        <div class="lector-qr-titulo">
          <span class="lector-qr-marca"><i data-lucide="scan-line" aria-hidden="true"></i></span>
          <h2 id="lector-qr-titulo">Escanear QR del vale</h2>
        </div>
        <button type="button" class="icon-btn" data-close aria-label="Cerrar lector QR">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </header>
      <div class="lector-qr-cuerpo">
        <div class="lector-qr-vista">
          <div class="lector-qr-guia">
            <i data-lucide="scan-qr-code" aria-hidden="true"></i>
            <p>${instruccion}</p>
          </div>
          <video playsinline muted hidden aria-label="Vista de la cámara"></video>
        </div>
        <div class="lector-qr-opciones">
          <button type="button" class="btn btn--primary" data-camera>
            <i data-lucide="camera" aria-hidden="true"></i> ${puedeTransmitir ? "Activar cámara" : "Tomar foto del QR"}
          </button>
          <button type="button" class="btn" data-upload>
            <i data-lucide="image-up" aria-hidden="true"></i> Leer imagen
          </button>
          <input type="file" accept="image/*" data-image hidden aria-label="Imagen del QR">
          <input type="file" accept="image/*" capture="environment" data-capture hidden aria-label="Foto del QR">
        </div>
        <p data-status role="status"></p>
        <details class="lector-qr-manual">
          <summary>Pegar enlace</summary>
          <form class="lector-qr-enlace">
            <div class="field">
              <label for="lector-qr-enlace">Enlace del vale</label>
              <input id="lector-qr-enlace" type="text" required maxlength="2048" autocomplete="off">
            </div>
            <button type="submit" class="btn">Buscar vale</button>
          </form>
        </details>
      </div>`;
    const video = dialog.querySelector("video");
    const status = dialog.querySelector("[data-status]");
    const camera = dialog.querySelector("[data-camera]");
    const guide = dialog.querySelector(".lector-qr-guia");
    const imageInput = dialog.querySelector("[data-image]");
    const captureInput = dialog.querySelector("[data-capture]");
    dialog.querySelector("[data-upload]").addEventListener("click", () => imageInput.click());
    const input = dialog.querySelector("#lector-qr-enlace");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    let stream, frame, busy = false, lastFrame = 0, previousRead;

    function stop() {
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    function decode(source, width, height) {
      const scale = Math.min(1, 1200 / Math.max(width, height));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return window.jsQR(image.data, image.width, image.height)?.data;
    }

    async function read(value) {
      if (busy || !dialog.open) return;
      const reference = parse(value);
      if (!reference) {
        status.textContent = "El código leído no tiene el formato de un vale.";
        return;
      }
      busy = true;
      try {
        const match = await resolve(reference);
        if (!dialog.open) return;
        if (!match) throw Error("No se encontró un vale disponible para este QR.");
        stop();
        dialog.close();
        onFound(match);
      } catch (error) {
        status.textContent = error.message;
      } finally {
        busy = false;
      }
    }

    function scan(time) {
      if (!dialog.open) return;
      if (!busy && time - lastFrame >= 150 && video.readyState >= 2) {
        lastFrame = time;
        const value = decode(video, video.videoWidth, video.videoHeight);
        if (value && value !== previousRead) read(value);
        previousRead = value;
      }
      if (dialog.open) frame = requestAnimationFrame(scan);
    }

    async function activarCamara() {
      camera.disabled = true;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
        if (!dialog.open) { stop(); return; }
        video.srcObject = stream;
        video.hidden = false;
        guide.hidden = true;
        await video.play();
        if (!dialog.open) return;
        status.textContent = "Cámara activa";
        frame = requestAnimationFrame(scan);
      } catch {
        stop();
        video.hidden = true;
        guide.hidden = false;
        camera.disabled = false;
        status.textContent = "No se pudo abrir la cámara. Usa una imagen o pega el enlace.";
      }
    }

    async function leerImagen(event) {
      const campo = event.currentTarget;
      const file = campo.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      try {
        const image = new Image();
        image.src = url;
        await image.decode();
        if (!dialog.open) return;
        const value = decode(image, image.naturalWidth, image.naturalHeight);
        if (value) await read(value);
        else status.textContent = "No se encontró un QR legible en la imagen.";
      } catch {
        status.textContent = "No se pudo leer la imagen.";
      } finally {
        URL.revokeObjectURL(url);
        campo.value = "";
      }
    }
    camera.addEventListener("click", puedeTransmitir ? activarCamara : () => captureInput.click());
    imageInput.addEventListener("change", leerImagen);
    captureInput.addEventListener("change", leerImagen);
    dialog.querySelector("form").addEventListener("submit", (event) => {
      event.preventDefault();
      read(input.value);
    });
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => { stop(); dialog.remove(); }, { once: true });
    document.body.append(dialog);
    dialog.showModal();
    window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
  }
  return { open };
})();
