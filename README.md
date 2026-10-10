# Lyric Edits

Edits de letras al estilo TikTok (pop de palabras, tipografía apilada, dreamy/fanfic, glitch/phonk, máquina de
escribir, karaoke) a partir de las letras de **Letras** y los pulsos de **StemLab**. Vídeo vertical 1080×1920 a
30 fps con el audio, exportado a MP4.

- **Edit en un clic**: en la biblioteca eliges modo y pinchas una canción; sale hecho:
  - *Automático* (local): estribillo, plantilla según bpm y energía (rápida y fuerte → Glitch/Stack, lenta o suave →
    Dreamy/Máquina), paleta, notas largas grandes y palabras del título en color. «🎲 Otra versión» prueba otra
    plantilla/colores sobre el mismo clip.
  - *✨ IA*: Claude decide plantilla, colores, efectos, palabras destacadas, cortes y velocidad (`ANTHROPIC_API_KEY`;
    modelo en `LYRIC_EDITS_MODEL`, por defecto `claude-sonnet-5-5`). Solo se le manda la letra del clip, bpm y energía.
    En el editor, «✨ Dirigir con IA» lo repite.
  - *Tus presets*: «Mis presets» guarda el estilo actual (plantilla, fuentes, colores, efectos, fondo, velocidad).
- **Editor** (Vite + React): vista previa en vivo con el mismo código que el render (Remotion Player).
  - **Timeline**: onda de la canción entera, versos y pulsos. Arrastra los bordes o el clip (imán a los versos; ⇧ sin
    imán), clic fuera mueve el clip, doble clic en un verso lo selecciona (⇧ amplía). Al crear un edit elige solo el
    estribillo (la línea que más se repite).
  - **Letra del clip**: clic en una palabra la elige y salta ahí (⇧ tramo, Ctrl sueltas). Teclas: `A` color de acento,
    `B` grande, `F` segunda fuente, `H` ocultar, `/` corte (empieza un grupo nuevo), `Enter` o doble clic cambia el
    texto, `Supr` lo quita todo.
  - **Plantilla, texto, ritmo y efectos, fondo**: zoom/temblor/flash/RGB al beat, grano, viñeta, luces, franjas,
    velocidad (slowed / sped up, con o sin cambio de tono), fondo degradado, liso o fotos/clips que cortan cada N beats.
  - Deshacer/rehacer (Ctrl+Z / Ctrl+Shift+Z), espacio reproduce, guardado automático.
- **Motores**: no hay IA propia, usa las de las otras dos apps con sus subcomandos JSON-lines (como sus apps Tauri):
  - Letras `library` para la lista, `find` + `ai` para «Añadir con Letras» (busca, descarga el audio y sincroniza
    palabra a palabra). Lee `lyrics/<clave>.json` y `audio/<clave>.wav`, con su desfase.
  - StemLab `separate` sobre el audio en caché de Letras (la canción queda en StemLab con el mismo id que la clave de
    Letras) y `beats`. La intensidad de los efectos sale de la pista de batería si existe.
- **Abrir desde otra app**: `http://127.0.0.1:5199/?song=<clave de Letras>` crea un edit de esa canción.

Datos: `$LYRIC_EDITS_DATA` o `~/.local/share/lyric-edits` (`projects/`, `media/`, `renders/`). Carpetas y motores de
las otras apps con su mismo criterio, o `LETRAS_DATA`, `STEMLAB_DATA`, `LETRAS_ENGINE`, `STEMLAB_ENGINE`.

## Uso

```sh
npm install
npm run dev        # http://127.0.0.1:5199
```

El primer render descarga Chrome Headless Shell (~100 MB). Tests: `npm test` (tiempos y grupos), `npm run check` (tipos).
