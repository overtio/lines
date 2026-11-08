import occtimportjs, { type Occt, type OcctMesh } from "occt-import-js";
import wasm from "occt-import-js/dist/occt-import-js.wasm?url";
import type { CadJob, CadMesh } from "./read";

/*
 * Reads CAD files (STEP, IGES, BREP) off the page with OpenCascade, which turns their surfaces into
 * triangles. It's large (7.6 MB), so it loads the first time a note shows one.
 */

let occt: Promise<Occt> | undefined;

/**
 * A mesh's color: its own, or the one all its faces share. Black is what CAD files without colors
 * say, so it's none: the mesh is drawn in the theme's.
 */
function colorOf(mesh: OcctMesh) {
  const colors = new Set(mesh.brep_faces.map((face) => face.color?.join()));
  const [only] = colors;
  const color = mesh.color ?? (colors.size === 1 && only ? mesh.brep_faces[0].color : null);
  return color?.some((channel) => channel > 0) ? color : null;
}

self.onmessage = async ({ data: { format, data } }: MessageEvent<CadJob>) => {
  try {
    occt ??= fetch(wasm)
      .then((response) => response.arrayBuffer())
      // What it says as it reads, which isn't for anyone.
      .then((wasmBinary) => occtimportjs({ wasmBinary, print: () => {}, printErr: () => {} }));
    const result = (await occt).ReadFile(format, data, { linearUnit: "millimeter" });
    if (!result.success) throw new Error();
    const meshes: CadMesh[] = result.meshes.map((mesh) => ({
      positions: new Float32Array(mesh.attributes.position.array),
      normals: mesh.attributes.normal ? new Float32Array(mesh.attributes.normal.array) : null,
      index: new Uint32Array(mesh.index.array),
      color: colorOf(mesh),
    }));
    const transfer = meshes.flatMap((mesh) => [mesh.positions.buffer, mesh.index.buffer, ...(mesh.normals ? [mesh.normals.buffer] : [])]);
    self.postMessage(meshes, { transfer });
  } catch {
    self.postMessage({ error: "" });
  }
};
