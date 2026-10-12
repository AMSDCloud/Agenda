# Agenda minimalista

Cada día: fecha, máximo 3 tareas importantes y una lista de cosas que van surgiendo. El fin de semana se asigna día a lo pendiente para la semana siguiente. Un día libre por semana para imprevistos. Cada tarea crea un evento de día completo en Google Calendar y cada acción queda en la hoja `Historial`.

## 1. Google Sheet + Apps Script (backend)

1. Creá una Google Sheet nueva (por ejemplo "Agenda").
2. Extensiones > Apps Script. Pegá el contenido de `Code.gs`.
3. Cambiá `TOKEN` por una clave larga propia (la misma va en `config.js`).
4. Configuración del proyecto (engranaje): zona horaria `America/Argentina/Buenos_Aires`.
5. Ejecutá `setup()` una vez y aceptá los permisos (Sheets y Calendar). Crea las hojas `Tareas`, `Pendientes`, `Config` e `Historial`.
6. Implementar > Nueva implementación > Aplicación web:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
7. Copiá la URL que termina en `/exec`.

Si cambiás `Code.gs` después, hay que crear una **nueva versión** de la implementación para que se apliquen los cambios.

## 2. Frontend

1. En `config.js` pegá la URL `/exec` y el mismo `TOKEN`.
2. Probalo local abriendo `index.html` con un servidor estático (VS Code > Live Server).

## 3. GitHub + Cloudflare Pages

1. Subí la carpeta a un repositorio de GitHub (`index.html`, `style.css`, `app.js`, `config.js`).
2. Cloudflare Pages > Create project > Connect to Git.
3. Build command: vacío. Output directory: `/`.
4. Cada `git push` redeploya.

## Notas

- **Token**: `config.js` es público en el navegador, así que el token es una protección liviana. Usá un repo privado y una URL de Pages poco evidente, y no guardes datos sensibles.
- **Día libre**: se cambia desde la vista Semana (por defecto viernes). Ese día no se pueden agendar tareas.
- **Cupo**: 3 tareas por día, validado en el backend. Asignar un pendiente lo convierte en una de esas 3 tareas; si borrás la tarea, el pendiente vuelve a "Fue surgiendo".
- **Fin de semana**: sábado y domingo la app abre en la vista Semana de la semana siguiente.
- **Calendario dedicado**: si preferís no mezclar con tu calendario principal, creá uno en Google Calendar y poné su ID en `CAL_ID`.
- **Notion**: esta versión usa Google Calendar y Google Sheets. Notion se puede sumar como segundo paso desde Apps Script con `UrlFetchApp` y la API de Notion.
