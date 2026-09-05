// Node tests exercise mixed server/client modules outside the Next compiler.
// Neutralize only Next's import marker, not React's runtime or application auth.
// Never loaded by the application or the production build.
const markerPath = require.resolve('server-only');
require.cache[markerPath] = { id: markerPath, filename: markerPath, loaded: true, exports: {} };
