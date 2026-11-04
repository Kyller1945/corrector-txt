import { correctJournal, MAX_FILE_BYTES, JournalError } from './lib/corrector.js';

const MAX_FILES = 20;
const MAX_SESSION_BYTES = 20 * 1024 * 1024;
const input = document.querySelector('#file-input');
const chooseButton = document.querySelector('#choose-files');
const clearButton = document.querySelector('#clear-files');
const dropZone = document.querySelector('#drop-zone');
const results = document.querySelector('#results');
const fileList = document.querySelector('#file-list');
const fileCount = document.querySelector('#file-count');
const sessionMessage = document.querySelector('#session-message');
const entries = [];
const queue = [];
let sessionBytes = 0;
let generation = 0;
let processingGeneration = null;
let dragDepth = 0;

function announce(message, isError = false) {
  sessionMessage.textContent = message;
  sessionMessage.classList.toggle('is-error', isError);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sizeLabel(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.ceil(bytes / 1024))} KiB`
    : `${(bytes / (1024 * 1024)).toLocaleString('es', { maximumFractionDigits: 1 })} MiB`;
}

function addRow(file) {
  const row = element('li', 'file-card');
  row.dataset.state = 'pending';
  const top = element('div', 'file-top');
  const summary = element('div', 'file-summary');
  const symbol = element('span', 'file-symbol', 'TXT');
  symbol.setAttribute('aria-hidden', 'true');
  const copy = element('div', 'file-copy');
  copy.append(element('h3', 'file-name', file.name), element('span', 'file-size', sizeLabel(file.size)));
  summary.append(symbol, copy);
  const status = element('span', 'file-status', 'En espera');
  top.append(summary, status);
  const bottom = element('div', 'file-bottom');
  const message = element('p', 'file-message', 'Se procesará en tu navegador.');
  bottom.append(message);
  row.append(top, bottom);
  fileList.append(row);
  const entry = { file, name: file.name, row, status, message, bottom, url: null };
  entries.push(entry);
  return entry;
}

function showError(entry, message) {
  entry.row.dataset.state = 'error';
  entry.status.textContent = 'No procesado';
  entry.message.textContent = message;
}

function showResult(entry, result) {
  if (result.changedCount === 0) {
    entry.row.dataset.state = 'unchanged';
    entry.status.textContent = 'Ya corregido';
    entry.message.textContent = `${result.detailCount.toLocaleString('es')} registros verificados. No necesita cambios.`;
    return;
  }

  const blob = new Blob([result.bytes], { type: 'text/plain' });
  entry.url = URL.createObjectURL(blob);
  entry.row.dataset.state = 'success';
  entry.status.textContent = 'Corregido';
  entry.message.textContent = `${result.changedCount.toLocaleString('es')} ${result.changedCount === 1 ? 'registro corregido' : 'registros corregidos'} · ${result.detailCount.toLocaleString('es')} verificados.`;
  const download = element('a', 'button button-download', 'Descargar TXT ↓');
  download.href = entry.url;
  download.download = `${entry.name.replace(/\.txt$/i, '')}_corregido.txt`;
  download.setAttribute('aria-label', `Descargar TXT corregido: ${entry.name}`);
  entry.bottom.append(download);

  const details = element('details', 'file-details');
  details.append(element('summary', '', 'Ver detalle de la corrección'));
  const preview = result.changedLines.slice(0, 12).join(', ');
  const remaining = result.changedLines.length > 12 ? ` y ${result.changedLines.length - 12} más` : '';
  details.append(element('p', '', `Líneas corregidas: ${preview}${remaining}.`));
  if (result.unchangedCount > 0) {
    details.append(element('p', '', `${result.unchangedCount.toLocaleString('es')} registros ya tenían 01 y se conservaron.`));
  }
  details.append(element('p', '', 'Cambio verificado: 10 → 01 antes de 2026. Los demás bytes se conservan.'));
  entry.row.append(details);
}

async function processQueue(runGeneration) {
  if (processingGeneration === runGeneration) return;
  processingGeneration = runGeneration;
  try {
    while (queue.length && runGeneration === generation) {
      const entry = queue.shift();
      entry.status.textContent = 'Verificando…';
      entry.message.textContent = 'Revisando el formato y cada registro.';
      announce(`Procesando ${entry.name}…`);
      try {
        const pendingRead = entry.file.arrayBuffer();
        entry.file = null;
        let buffer = await pendingRead;
        if (runGeneration !== generation) return;
        const result = correctJournal(new Uint8Array(buffer));
        buffer = null;
        showResult(entry, result);
      } catch (error) {
        entry.file = null;
        if (runGeneration !== generation) return;
        const message = error instanceof JournalError
          ? error.message
          : 'No se pudo leer este archivo. Vuelve a seleccionarlo e inténtalo de nuevo.';
        showError(entry, message);
      }
    }
    if (runGeneration === generation) {
      const changed = entries.filter((entry) => entry.row.dataset.state === 'success').length;
      const errors = entries.filter((entry) => entry.row.dataset.state === 'error').length;
      announce(`Revisión terminada. ${changed} ${changed === 1 ? 'archivo listo' : 'archivos listos'} para descargar.${errors ? ` ${errors} ${errors === 1 ? 'archivo no pudo procesarse' : 'archivos no pudieron procesarse'}. Revisa el detalle.` : ''}`);
    }
  } finally {
    if (processingGeneration === runGeneration) processingGeneration = null;
  }
}

function addFiles(files) {
  if (!files.length) return;
  const remaining = MAX_FILES - entries.length;
  if (files.length > remaining) {
    announce(`Puedes agregar ${remaining} ${remaining === 1 ? 'archivo más' : 'archivos más'}. El límite es de 20 por sesión. Limpia los archivos para comenzar de nuevo.`, true);
    return;
  }
  let batchBytes = 0;
  for (let index = 0; index < files.length; index += 1) batchBytes += files[index].size;
  if (sessionBytes + batchBytes > MAX_SESSION_BYTES) {
    announce('Esta selección supera los 20 MiB de la sesión. Selecciona menos archivos o limpia los actuales.', true);
    return;
  }

  sessionBytes += batchBytes;
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const entry = addRow(file);
    if (!/\.txt$/i.test(file.name)) {
      entry.file = null;
      showError(entry, 'Selecciona un archivo con extensión .txt.');
    } else if (file.size > MAX_FILE_BYTES) {
      entry.file = null;
      showError(entry, 'Este archivo supera el límite de 5 MiB.');
    } else {
      queue.push(entry);
    }
  }
  results.hidden = false;
  fileCount.textContent = String(entries.length);
  chooseButton.disabled = entries.length >= MAX_FILES;
  void processQueue(generation);
}

function clearFiles() {
  generation += 1;
  for (const entry of entries) {
    entry.file = null;
    if (entry.url) URL.revokeObjectURL(entry.url);
    entry.url = null;
  }
  queue.length = 0;
  entries.length = 0;
  sessionBytes = 0;
  fileList.replaceChildren();
  results.hidden = true;
  fileCount.textContent = '0';
  input.value = '';
  chooseButton.disabled = false;
  announce('Archivos eliminados de esta sesión. Puedes comenzar de nuevo.');
}

chooseButton.addEventListener('click', () => input.click());
input.addEventListener('change', () => {
  addFiles(input.files);
  input.value = '';
});
clearButton.addEventListener('click', () => {
  clearFiles();
  chooseButton.focus();
});

dropZone.addEventListener('dragenter', (event) => {
  event.preventDefault();
  dragDepth += 1;
  dropZone.classList.add('is-dragging');
});
dropZone.addEventListener('dragover', (event) => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
});
dropZone.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dropZone.classList.remove('is-dragging');
});
dropZone.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove('is-dragging');
  if (event.dataTransfer) addFiles(event.dataTransfer.files);
});
document.addEventListener('dragover', (event) => event.preventDefault());
document.addEventListener('drop', (event) => event.preventDefault());
window.addEventListener('pagehide', clearFiles);
