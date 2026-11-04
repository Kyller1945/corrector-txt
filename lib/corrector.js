export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export class JournalError extends Error {
  constructor(message, line) {
    super(line === undefined ? message : `Línea ${line}: ${message}`);
    this.name = 'JournalError';
    this.line = line;
  }
}

/**
 * Correct the known fixed-width journal format without decoding its contents.
 * Line numbers are one-based and include the header. Input is never modified.
 */
export function correctJournal(input) {
  if (!(input instanceof Uint8Array)) {
    throw new JournalError('El archivo debe recibirse como una secuencia de bytes.');
  }
  if (input.length > MAX_FILE_BYTES) {
    throw new JournalError('El archivo supera el máximo de 5 MiB.');
  }

  const utf32 = (input[0] === 0xff && input[1] === 0xfe && input[2] === 0 && input[3] === 0)
    || (input[0] === 0 && input[1] === 0 && input[2] === 0xfe && input[3] === 0xff);
  const utf16 = (input[0] === 0xff && input[1] === 0xfe)
    || (input[0] === 0xfe && input[1] === 0xff);
  if (utf32 || utf16) {
    throw new JournalError('No se admiten archivos UTF-16 ni UTF-32. Utiliza el TXT original en una codificación compatible con ASCII.');
  }

  const hasUtf8Bom = input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf;
  const firstByte = hasUtf8Bom ? 3 : 0;
  if (firstByte === input.length) {
    throw new JournalError('El archivo está vacío. Debe contener una cabecera y al menos un detalle.');
  }

  const detailOffsets = [];
  const changeOffsets = [];
  const changedLines = [];
  let lineNumber = 0;

  const validateLine = (start, end) => {
    lineNumber += 1;
    const length = end - start;
    if (length === 0) {
      throw new JournalError('Se encontró una línea en blanco; el formato no la admite.', lineNumber);
    }
    for (let index = start; index < end; index += 1) {
      if (input[index] < 0x20 || input[index] === 0x7f) {
        throw new JournalError('Se encontró un byte de control o contenido binario. No se admiten UTF-16 ni UTF-32.', lineNumber);
      }
    }
    if (lineNumber === 1) {
      if (length !== 68 || input[start] !== 0x50) {
        throw new JournalError('La cabecera debe comenzar con P y tener exactamente 68 bytes.', lineNumber);
      }
      return;
    }
    if (length !== 107 || input[start] !== 0x36) {
      throw new JournalError('El detalle debe comenzar con 6 y tener exactamente 107 bytes.', lineNumber);
    }
    if (input[start + 83] !== 0x30 || input[start + 84] !== 0x30) {
      throw new JournalError('Se esperaba el prefijo 00 en las columnas 84–85.', lineNumber);
    }
    if (input[start + 87] !== 0x32 || input[start + 88] !== 0x30
      || input[start + 89] !== 0x32 || input[start + 90] !== 0x36) {
      throw new JournalError('Se esperaba el año 2026 en las columnas 88–91.', lineNumber);
    }
    const fieldOffset = start + 85;
    const pending = input[fieldOffset] === 0x31 && input[fieldOffset + 1] === 0x30;
    const corrected = input[fieldOffset] === 0x30 && input[fieldOffset + 1] === 0x31;
    if (!pending && !corrected) {
      throw new JournalError('El campo de las columnas 86–87 debe ser 10 o 01.', lineNumber);
    }
    detailOffsets.push(fieldOffset);
    if (pending) {
      changeOffsets.push(fieldOffset);
      changedLines.push(lineNumber);
    }
  };

  // Read CRLF as one delimiter, preserving lone CR and LF and the final newline.
  let lineStart = firstByte;
  for (let index = firstByte; index < input.length; index += 1) {
    if (input[index] === 0x0d || input[index] === 0x0a) {
      validateLine(lineStart, index);
      if (input[index] === 0x0d && input[index + 1] === 0x0a) index += 1;
      lineStart = index + 1;
    }
  }
  if (lineStart < input.length) validateLine(lineStart, input.length);
  if (detailOffsets.length === 0) {
    throw new JournalError('El archivo debe contener al menos una línea de detalle además de la cabecera.');
  }

  // Do not allocate or change the output until every input record is valid.
  const bytes = new Uint8Array(input);
  for (const offset of changeOffsets) {
    bytes[offset] = 0x30;
    bytes[offset + 1] = 0x31;
  }

  // Verify all records and all bytes, including BOM, spacing and line endings.
  let changeIndex = 0;
  for (let index = 0; index < input.length; index += 1) {
    if (index === changeOffsets[changeIndex]) {
      if (bytes[index] !== 0x30 || bytes[index + 1] !== 0x31
        || input[index] !== 0x31 || input[index + 1] !== 0x30) {
        throw new JournalError('No se pudo verificar la corrección del archivo.');
      }
      index += 1;
      changeIndex += 1;
    } else if (bytes[index] !== input[index]) {
      throw new JournalError('La verificación detectó un cambio fuera de las columnas permitidas.');
    }
  }
  for (const offset of detailOffsets) {
    if (bytes[offset] !== 0x30 || bytes[offset + 1] !== 0x31) {
      throw new JournalError('La verificación detectó un detalle pendiente de corrección.');
    }
  }

  return {
    bytes,
    detailCount: detailOffsets.length,
    changedCount: changeOffsets.length,
    unchangedCount: detailOffsets.length - changeOffsets.length,
    changedLines,
    verified: true,
  };
}
