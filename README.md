# Corrector de TXT

Página sencilla en español para corregir diarios TXT dentro del navegador. Selecciona o arrastra archivos, revisa el resultado y descarga cada copia corregida.

## Publicar en GitHub Pages

1. Crea un repositorio público en GitHub, por ejemplo `corrector-txt`.
2. Extrae el ZIP. En el repositorio, elige **Add file → Upload files**.
3. Arrastra el contenido extraído: `index.html`, `styles.css`, `app.js`, `README.md` y las carpetas `lib` y `assets`. Incluye `.nojekyll` si aparece. **index.html debe quedar en la raíz del repositorio**, no dentro de otra carpeta.
4. Pulsa **Commit changes** para guardar en la rama `main`.
5. Entra en **Settings → Pages**. En **Build and deployment**, selecciona **Deploy from a branch**.
6. Selecciona **main** y **/ (root)**; pulsa **Save**.
7. Espera a que GitHub publique el sitio. Su dirección aparecerá en esa misma pantalla; normalmente será `https://TU-USUARIO.github.io/corrector-txt/`.

No necesitas instalar programas, contratar un servidor ni configurar claves. Si la red de tu empresa bloquea el dominio `github.io`, necesitarás un alojamiento permitido por la empresa.

## Archivos de la página

```
index.html
styles.css
app.js
lib/
  corrector.js
assets/
  icon.svg
README.md
.nojekyll
```

## Corrección y límites

- Cambia únicamente `10` por `01` en las columnas 86–87 del detalle, justo antes de `2026`, con el prefijo `00`: `00102026` pasa a `00012026`.
- El formato esperado tiene una cabecera de 68 bytes que empieza por `P` y detalles de 107 bytes que empiezan por `6`.
- Conserva todos los demás bytes: encabezado, espacios, codificación compatible con ASCII, BOM UTF-8 si existe y saltos CRLF, LF o CR.
- Verifica el archivo completo antes de ofrecer la descarga. Si el formato es inesperado, muestra el error y no genera una salida parcial.
- Los detalles que ya contienen `01` se conservan. Si todo el archivo está corregido, lo indica sin generar otra copia.
- No admite UTF-16 ni UTF-32. Utiliza el TXT original exportado por tu sistema.
- Hasta 20 archivos y 20 MiB por sesión; máximo 5 MiB por archivo.

## Privacidad

Sube al repositorio únicamente los archivos de esta página. **No subas tus diarios TXT reales a GitHub.**

La página lee los archivos seleccionados en memoria y genera la descarga en tu equipo. No tiene servidor de procesamiento, analítica, historial, almacenamiento del navegador ni servicios externos. Su política de seguridad bloquea las conexiones salientes desde el código. El botón **Limpiar archivos** libera los resultados de la sesión. El original y las copias que descargues siguen siendo archivos de tu equipo.

GitHub sirve la página y puede registrar datos normales de la visita, como la dirección IP; el código de esta herramienta no envía el contenido de los TXT.

## Verificación realizada

El núcleo y la política de privacidad pasaron 41 pruebas automáticas con datos ficticios: cambios en posiciones exactas, conservación de bytes, archivos ya corregidos, combinaciones de líneas, saltos de línea, codificaciones y errores de formato. La comprobación visual del sitio publicado queda pendiente de la publicación.
