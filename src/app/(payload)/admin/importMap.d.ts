/*
 * `payload generate:importmap` writes plain JavaScript, and this project sets
 * `allowJs: false`, so tsc needs a declaration to type the generated module.
 * The shape is fixed by Payload, so this file does not need regenerating when
 * importMap.js does.
 */
import type { ImportMap } from "payload";

export declare const importMap: ImportMap;
