import { BufferAttribute, BufferGeometry, Color, Group, Loader, Mesh, MeshStandardMaterial, type Object3D, SRGBColorSpace } from "three";
import { t } from "../../lib/i18n/index.svelte";
import { Jobs } from "./jobs";
import { readOff } from "./off";

/*
 * 3D files read into what the viewer draws (view.ts). Meshes without colors of their own are drawn
 * in the theme's; those with them (a 3MF's, a glTF's, OpenSCAD's `color()`) keep theirs. Files from
 * CAD and 3D printing have Z up; the rest (glTF, OBJ, PLY), Y.
 */

export interface Model {
  object: Object3D;
  /** Whether its up is Z, rather than Y. */
  zUp: boolean;
}

/** A mesh drawn in the theme's color: its material is set by the viewer. */
export const plain = (geometry: BufferGeometry) => Object.assign(new Mesh(geometry), { userData: { plain: true } });

/** A mesh with colors of its own, from its geometry's color attribute, or one color. */
function colored(geometry: BufferGeometry, color?: Color) {
  return new Mesh(geometry, new MeshStandardMaterial({ color: color ?? 0xffffff, vertexColors: !color, roughness: 0.6 }));
}

/**
 * Marks the meshes a loader gave its default material (or every one, with `all`) as drawn in the
 * theme's color, unless their corners have colors.
 */
function plainDefaults(object: Object3D, all = false) {
  object.traverse((child) => {
    if (!(child instanceof Mesh) || child.geometry.hasAttribute("color")) return;
    if (all || (!Array.isArray(child.material) && child.material.name === Loader.DEFAULT_MATERIAL_NAME)) child.userData.plain = true;
  });
  return object;
}

function geometryOf(positions: Float32Array, normals?: Float32Array | null, index?: Uint32Array) {
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  if (index) geometry.setIndex(new BufferAttribute(index, 1));
  if (normals) geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  else geometry.computeVertexNormals();
  return geometry;
}

/** An OFF file's model: the faces without colors in the theme's, those with in theirs. */
export function offModel(text: string): Model {
  const { plain: faces, colored: own } = readOff(text);
  const object = new Group();
  if (faces.length) object.add(plain(geometryOf(faces)));
  if (own.positions.length) {
    const geometry = geometryOf(own.positions);
    // Colors are given in sRGB; the viewer works in linear light.
    const color = new Color();
    const linear = new Float32Array(own.colors.length);
    for (let i = 0; i < linear.length; i += 3) {
      color.setRGB(own.colors[i] / 255, own.colors[i + 1] / 255, own.colors[i + 2] / 255, SRGBColorSpace);
      linear.set([color.r, color.g, color.b], i);
    }
    geometry.setAttribute("color", new BufferAttribute(linear, 3));
    object.add(colored(geometry));
  }
  return { object, zUp: true };
}

/* CAD files, read by OpenCascade in a worker (step.worker.ts). */

export interface CadJob {
  format: "step" | "iges" | "brep";
  data: Uint8Array;
}

export interface CadMesh {
  positions: Float32Array;
  normals: Float32Array | null;
  index: Uint32Array;
  /** Red, green and blue from 0 to 1, in sRGB. */
  color: [number, number, number] | null;
}

const cad = new Jobs<CadJob, CadMesh[]>(() => new Worker(new URL("./step.worker.ts", import.meta.url), { type: "module" }), 120_000);

async function cadModel(format: CadJob["format"], data: ArrayBuffer): Promise<Model> {
  const meshes = await cad.run({ format, data: new Uint8Array(data) }, [data]);
  const object = new Group();
  for (const mesh of meshes) {
    const geometry = geometryOf(mesh.positions, mesh.normals, mesh.index);
    object.add(mesh.color ? colored(geometry, new Color().setRGB(...mesh.color, SRGBColorSpace)) : plain(geometry));
  }
  return { object, zUp: true };
}

/** A file's model, by its extension. Throws, saying so, on one it can't read. */
export async function readModel(name: string, data: ArrayBuffer): Promise<Model> {
  const extension = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const text = () => new TextDecoder().decode(data);
  try {
    switch (extension) {
      case "stl": {
        const { STLLoader } = await import("three/examples/jsm/loaders/STLLoader.js");
        const geometry = new STLLoader().parse(data);
        // Its own normals are often missing or wrong.
        geometry.computeVertexNormals();
        return { object: geometry.hasAttribute("color") ? colored(geometry) : plain(geometry), zUp: true };
      }
      case "obj": {
        const { OBJLoader } = await import("three/examples/jsm/loaders/OBJLoader.js");
        // Without its .mtl file, its materials are only names.
        return { object: plainDefaults(new OBJLoader().parse(text()), true), zUp: false };
      }
      case "ply": {
        const { PLYLoader } = await import("three/examples/jsm/loaders/PLYLoader.js");
        const geometry = new PLYLoader().parse(data);
        if (!geometry.hasAttribute("normal")) geometry.computeVertexNormals();
        return { object: geometry.hasAttribute("color") ? colored(geometry) : plain(geometry), zUp: false };
      }
      case "off":
        return offModel(text());
      case "3mf": {
        const { ThreeMFLoader } = await import("three/examples/jsm/loaders/3MFLoader.js");
        return { object: plainDefaults(new ThreeMFLoader().parse(data)), zUp: true };
      }
      case "glb":
      case "gltf": {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        return { object: plainDefaults((await new GLTFLoader().parseAsync(data, "")).scene), zUp: false };
      }
      case "step":
      case "stp":
        return await cadModel("step", data);
      case "iges":
      case "igs":
        return await cadModel("iges", data);
      case "brep":
        return await cadModel("brep", data);
    }
  } catch (error) {
    console.error("lines: couldn't read a model", error);
  }
  throw new Error(t("models.unreadable", { kind: extension.toUpperCase() }));
}
