/** OpenCascade's reader for CAD files (STEP, IGES, BREP), built to WebAssembly: https://github.com/kovacsv/occt-import-js */
declare module "occt-import-js" {
  export interface OcctMesh {
    name: string;
    /** Red, green and blue from 0 to 1. */
    color?: [number, number, number];
    brep_faces: { first: number; last: number; color: [number, number, number] | null }[];
    attributes: { position: { array: number[] }; normal?: { array: number[] } };
    index: { array: number[] };
  }

  export interface Occt {
    ReadFile(
      format: "step" | "iges" | "brep",
      content: Uint8Array,
      params: { linearUnit?: "millimeter" | "centimeter" | "meter" | "inch" | "foot" } | null,
    ): { success: boolean; meshes: OcctMesh[] };
  }

  export default function occtimportjs(options?: {
    wasmBinary?: ArrayBuffer;
    locateFile?: (path: string) => string;
    print?: (line: string) => void;
    printErr?: (line: string) => void;
  }): Promise<Occt>;
}
