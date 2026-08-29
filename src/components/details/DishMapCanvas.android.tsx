// Google Maps crashes during native view creation when no Android API key is
// bundled. Keep the Dish map usable in demo builds by resolving Android to the
// interactive branded canvas; iOS continues to resolve the native map file.
export { DishMapCanvas } from './DishMapCanvasFallback';
export type { DishMapCanvasProps } from './DishMapCanvasFallback';
