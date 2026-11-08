import {
  Box3,
  type BufferGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  type Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mount, unmount } from "svelte";
import { solid } from "../../lib/colors";
import { lookKey } from "../../lib/editor/rendered";
import Icon from "../../lib/icons/Icon.svelte";
import { locale, t } from "../../lib/i18n/index.svelte";
import type { Model } from "./read";

/*
 * A 3D model to turn around, in a note: dragging turns it, a right drag (or ⇧ drag, or two
 * fingers) moves it, and pinching (or ⌘ or Ctrl with the scroll wheel) zooms; the wheel alone
 * still scrolls the note. With the keyboard, the arrow keys turn it, + and − zoom, and 0 puts it
 * back. Its size shows in a corner, and OpenSCAD's warnings and echoes below it.
 *
 * Models are drawn only when something changes. One WebGL renderer draws them all, each into a
 * canvas of its own: browsers allow only a few WebGL contexts at a time, and a note can have many
 * models. A model's view is kept for the place it's drawn in and for the model, so it stays put
 * while its code changes, or when it's drawn again.
 */

/* Looks: what models without colors of their own are drawn in, and their edges. */

interface Look {
  model: MeshStandardMaterial;
  edges: LineBasicMaterial;
}

const newLook = (model: string, edges: string, edgeOpacity: number): Look => ({
  model: new MeshStandardMaterial({ color: model, roughness: 0.62, metalness: 0.05 }),
  edges: new LineBasicMaterial({ color: edges, transparent: true, opacity: edgeOpacity }),
});

const PAPER = newLook("#e4e4e4", "#1a1a1a", 0.85);

let screen: { key: string; look: Look } | undefined;

/** The look on screen, from the theme: reading it forces style recalculations, so it's done once per look. */
function screenLook(): Look {
  const key = lookKey();
  if (screen?.key !== key) {
    // A light tint of the accent in either scheme: its sides darken as they turn from the light.
    const base = document.documentElement.dataset.scheme === "dark" ? "--text" : "--bg";
    screen?.look.model.dispose();
    screen?.look.edges.dispose();
    screen = { key, look: newLook(solid(`color-mix(in srgb, var(--accent) 45%, var(${base}))`), solid("var(--text)"), 0.35) };
  }
  return screen.look;
}

/* The renderer. */

let gl: { renderer: WebGLRenderer; environment: Texture } | null = null;

/** The renderer every model is drawn with, made the first time; null where WebGL isn't there. */
function shared() {
  if (gl) return gl;
  try {
    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    // Soft light from all around, as from a room, so no side is lost in shadow.
    const pmrem = new PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    // Lost (the graphics card reset, say): a new renderer draws every model again.
    renderer.domElement.addEventListener("webglcontextlost", () => {
      gl = null;
      for (const view of views) view.restage();
    });
    return (gl = { renderer, environment });
  } catch {
    return null;
  }
}

/* A model, ready to draw. */

/** Edges where faces meet at an angle, drawn over meshes up to this many triangles. */
const EDGE_ANGLE = 35;
const EDGE_LIMIT = 300_000;
const edgeCache = new WeakMap<BufferGeometry, EdgesGeometry>();

interface Staged {
  scene: Scene;
  /** Its center is at the origin; this is how far its farthest corner is. */
  radius: number;
  /** Its size along its own axes. */
  size: Vector3;
}

function triangles(object: Object3D) {
  let count = 0;
  object.traverse((child) => {
    if (child instanceof Mesh) count += (child.geometry.index?.count ?? child.geometry.getAttribute("position").count) / 3;
  });
  return count;
}

/** A model in a scene of its own, in a look: Y up, its center at the origin. */
function stage(model: Model, look: Look): Staged {
  const scene = new Scene();
  scene.environment = shared()?.environment ?? null;
  scene.environmentIntensity = 0.4;
  const content = model.object.clone(true);
  const { model: material, edges } = look;
  const outline = triangles(content) <= EDGE_LIMIT;
  content.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    if (child.userData.plain) child.material = material;
    // Both sides of every face, as meshes from scans and some exporters face some of theirs inward;
    // and each face a little behind its edges, so they show whole.
    for (const own of [child.material].flat()) Object.assign(own, { side: DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    if (outline) {
      let geometry = edgeCache.get(child.geometry);
      if (!geometry) edgeCache.set(child.geometry, (geometry = new EdgesGeometry(child.geometry, EDGE_ANGLE)));
      child.add(new LineSegments(geometry, edges));
    }
  });
  const size = new Box3().setFromObject(content).getSize(new Vector3());
  const holder = new Group();
  holder.add(content);
  if (model.zUp) holder.rotation.x = -Math.PI / 2;
  holder.updateMatrixWorld(true);
  const box = new Box3().setFromObject(holder);
  holder.position.copy(box.getCenter(new Vector3()).negate());
  scene.add(holder);
  return { scene, radius: Math.max(box.getSize(new Vector3()).length() / 2, 1e-6), size };
}

/** A light from above and behind the viewer's left shoulder, which moves with them: the top lightest, the right side darkest. */
function headlight() {
  const light = new DirectionalLight(0xffffff, 1.6);
  // Both in the camera's own space: from up and to the left, toward what it looks at.
  light.position.set(-0.5, 1, 0.3);
  light.target.position.set(0, 0, -1);
  return new Group().add(light, light.target);
}

/* Where it's seen from. */

interface Orbit {
  /** Around it, and from above (0) to below (π). */
  theta: number;
  phi: number;
  /** How far, 1 being just far enough to see all of it. */
  zoom: number;
  /** Where it looks, from the model's center, in its radius. */
  pan: Vector3;
}

const FOV = 30;
const START: Orbit = { theta: Math.PI / 5, phi: Math.PI / 2.9, zoom: 1.08, pan: new Vector3() };
const copyOrbit = (orbit: Orbit): Orbit => ({ ...orbit, pan: orbit.pan.clone() });
const atStart = (orbit: Orbit) =>
  orbit.theta === START.theta && orbit.phi === START.phi && orbit.zoom === START.zoom && orbit.pan.lengthSq() === 0;

/** Views kept by the element a model is drawn in, and by the model, as the last ones seen. */
const byPlace = new WeakMap<Element, Orbit>();
const byModel = new Map<string, Orbit>();

function rememberOrbit(key: string, orbit: Orbit) {
  byModel.delete(key);
  byModel.set(key, orbit);
  if (byModel.size > 100) byModel.delete(byModel.keys().next().value!);
}

/** Puts `camera` where `orbit` says, for a model of `radius`. */
function place(camera: PerspectiveCamera, orbit: Orbit, radius: number) {
  // Far enough to fit it across the narrower side.
  const half = Math.min(FOV / 2, (Math.atan(Math.tan((FOV / 2) * (Math.PI / 180)) * camera.aspect) * 180) / Math.PI);
  const distance = (radius / Math.sin(half * (Math.PI / 180))) * orbit.zoom;
  const target = orbit.pan.clone().multiplyScalar(radius);
  camera.position.set(Math.sin(orbit.phi) * Math.sin(orbit.theta), Math.cos(orbit.phi), Math.sin(orbit.phi) * Math.cos(orbit.theta)).multiplyScalar(distance).add(target);
  camera.near = Math.max(distance - radius * 2, distance / 100);
  camera.far = distance + radius * 4;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}

/* The element. */

const views = new Set<ModelView>();

const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
const sizeText = (size: Vector3) => [size.x, size.y, size.z].map((n) => number.format(n)).join(" × ");

const TURN = Math.PI / 12;

class ModelView extends HTMLElement {
  #model!: Model;
  #key = "";
  #staged: Staged | null = null;
  #look: Look | null = null;
  #orbit: Orbit = copyOrbit(START);
  #place: Element | null = null;
  readonly #camera = new PerspectiveCamera(FOV, 1, 0.1, 1000);
  readonly #canvas = document.createElement("canvas");
  readonly #reset = document.createElement("button");
  readonly #size = document.createElement("span");
  #icon: Record<string, unknown> | null = null;
  #frame = 0;
  readonly #resize = new ResizeObserver(() => this.redraw());
  /** The pointers down on it, where they were last. */
  readonly #pointers = new Map<number, { x: number; y: number }>();
  #panning = false;
  #pinch = 0;
  #gesture = 1;

  /** Shows `model`, whose view is remembered by `key`, with OpenSCAD's `notes` below it. */
  show(model: Model, key: string, notes: string[]) {
    this.#model = model;
    this.#key = key;
    this.className = "cm-lp-model";
    this.tabIndex = 0;
    this.setAttribute("role", "img");
    this.setAttribute("aria-roledescription", t("models.model"));
    this.setAttribute("aria-description", t("models.keys"));
    this.#camera.add(headlight());
    this.#canvas.className = "cm-lp-model-canvas";
    this.#reset.type = "button";
    this.#reset.className = "cm-lp-action cm-lp-model-reset";
    this.#reset.tabIndex = -1;
    this.#reset.title = t("models.reset");
    this.#reset.setAttribute("aria-label", t("models.reset"));
    this.#reset.addEventListener("click", () => this.#move(copyOrbit(START)));
    // Its own click, not one on the model.
    this.#reset.addEventListener("mousedown", (event) => event.stopPropagation());
    this.#size.className = "cm-lp-model-size";
    // What takes drags (editor/util.ts): pressing it shows the code, or selects the file, only if it isn't dragged.
    const stage = document.createElement("div");
    stage.className = "cm-lp-model-stage cm-lp-interactive";
    stage.append(this.#canvas, this.#reset, this.#size);
    this.append(stage);
    if (notes.length) {
      const list = document.createElement("pre");
      list.className = "cm-lp-model-notes";
      list.textContent = notes.join("\n");
      this.append(list);
    }
    this.#listen();
  }

  connectedCallback() {
    views.add(this);
    this.#icon ??= mount(Icon, { target: this.#reset, props: { name: "restore", size: 15 } });
    this.#place = this.parentElement;
    const kept = (this.#place && byPlace.get(this.#place)) ?? byModel.get(this.#key);
    if (kept) this.#orbit = copyOrbit(kept);
    this.#resize.observe(this);
    this.redraw();
  }

  disconnectedCallback() {
    views.delete(this);
    if (this.#icon) void unmount(this.#icon);
    this.#icon = null;
    this.#resize.disconnect();
    if (this.#place) byPlace.set(this.#place, copyOrbit(this.#orbit));
    // Its geometry's memory on the graphics card, unless it's only being moved.
    setTimeout(() => {
      if (this.isConnected) return;
      this.#staged?.scene.traverse((child) => {
        if (child instanceof Mesh || child instanceof LineSegments) (child.geometry as BufferGeometry).dispose();
      });
    }, 1000);
  }

  /** Draws it again from its model: for a new renderer. */
  restage() {
    this.#staged = null;
    this.redraw();
  }

  redraw() {
    cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => this.#draw());
  }

  #draw() {
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;
    if (!width || !height) return;
    const engine = shared();
    if (!engine) {
      this.#size.textContent = t("models.noWebGL");
      return;
    }
    const look = screenLook();
    if (look !== this.#look || !this.#staged) {
      this.#look = look;
      this.#staged = stage(this.#model, look);
      const text = sizeText(this.#staged.size);
      this.#size.textContent = text;
      this.setAttribute("aria-label", t("models.label", { size: text }));
    }
    const ratio = devicePixelRatio;
    const pixels = [Math.round(width * ratio), Math.round(height * ratio)];
    if (this.#canvas.width !== pixels[0] || this.#canvas.height !== pixels[1]) [this.#canvas.width, this.#canvas.height] = pixels;
    const { renderer } = engine;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    place(this.#camera, this.#orbit, this.#staged.radius);
    this.#staged.scene.add(this.#camera);
    renderer.render(this.#staged.scene, this.#camera);
    const context = this.#canvas.getContext("2d")!;
    context.clearRect(0, 0, pixels[0], pixels[1]);
    context.drawImage(renderer.domElement, 0, 0);
    this.#reset.hidden = atStart(this.#orbit);
  }

  #move(orbit: Orbit) {
    orbit.phi = Math.min(Math.PI - 0.01, Math.max(0.01, orbit.phi));
    orbit.zoom = Math.min(40, Math.max(0.05, orbit.zoom));
    this.#orbit = orbit;
    rememberOrbit(this.#key, copyOrbit(orbit));
    this.redraw();
  }

  /** Moves where it looks by `dx` and `dy` pixels on screen. */
  #pan(dx: number, dy: number) {
    const { radius } = this.#staged ?? { radius: 1 };
    const height = this.#canvas.clientHeight || 1;
    const distance = this.#camera.position.distanceTo(this.#orbit.pan.clone().multiplyScalar(radius));
    const perPixel = (2 * distance * Math.tan((FOV / 2) * (Math.PI / 180))) / height / radius;
    const right = new Vector3().setFromMatrixColumn(this.#camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(this.#camera.matrixWorld, 1);
    const pan = this.#orbit.pan.clone().addScaledVector(right, -dx * perPixel).addScaledVector(up, dy * perPixel);
    this.#move({ ...this.#orbit, pan });
  }

  #turn(dx: number, dy: number) {
    this.#move({ ...this.#orbit, theta: this.#orbit.theta - dx, phi: this.#orbit.phi - dy, pan: this.#orbit.pan.clone() });
  }

  #zoom(by: number) {
    this.#move({ ...this.#orbit, zoom: this.#orbit.zoom * by, pan: this.#orbit.pan.clone() });
  }

  #listen() {
    const canvas = this.#canvas;
    const spread = () => {
      const [a, b] = [...this.#pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const middle = () => {
      const points = [...this.#pointers.values()];
      return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
    };
    canvas.addEventListener("pointerdown", (event) => {
      if (event.button > 2 || this.#pointers.size >= 2) return;
      canvas.setPointerCapture(event.pointerId);
      this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.#panning = event.button !== 0 || event.shiftKey;
      if (this.#pointers.size === 2) this.#pinch = spread();
    });
    canvas.addEventListener("pointermove", (event) => {
      const last = this.#pointers.get(event.pointerId);
      if (!last) return;
      if (this.#pointers.size === 2) {
        const before = middle();
        const spreadBefore = this.#pinch;
        this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const after = middle();
        this.#pinch = spread();
        if (spreadBefore && this.#pinch) this.#zoom(spreadBefore / this.#pinch);
        this.#pan(after.x - before.x, after.y - before.y);
        return;
      }
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (this.#panning) this.#pan(dx, dy);
      else this.#turn((dx / Math.max(canvas.clientWidth, 1)) * Math.PI * 1.5, (dy / Math.max(canvas.clientHeight, 1)) * Math.PI);
    });
    const up = (event: PointerEvent) => {
      this.#pointers.delete(event.pointerId);
      this.#pinch = 0;
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    // A right drag moves it.
    canvas.addEventListener("contextmenu", (event) => event.preventDefault());
    // Pinching on a trackpad comes as the wheel with Ctrl held.
    canvas.addEventListener(
      "wheel",
      (event) => {
        if (!event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        this.#zoom(Math.exp(Math.max(-1, Math.min(1, event.deltaY * (event.deltaMode ? 0.05 : 0.01)))));
      },
      { passive: false },
    );
    // Safari's own pinch.
    canvas.addEventListener("gesturestart", (event) => {
      event.preventDefault();
      this.#gesture = 1;
    });
    canvas.addEventListener("gesturechange", (event) => {
      event.preventDefault();
      const scale = (event as Event & { scale: number }).scale;
      this.#zoom(this.#gesture / scale);
      this.#gesture = scale;
    });
    this.addEventListener("keydown", (event) => {
      if (event.target !== this || event.metaKey || event.ctrlKey || event.altKey) return;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => (event.shiftKey ? this.#pan(-40, 0) : this.#turn(-TURN, 0)),
        ArrowRight: () => (event.shiftKey ? this.#pan(40, 0) : this.#turn(TURN, 0)),
        ArrowUp: () => (event.shiftKey ? this.#pan(0, -40) : this.#turn(0, -TURN)),
        ArrowDown: () => (event.shiftKey ? this.#pan(0, 40) : this.#turn(0, TURN)),
        "+": () => this.#zoom(1 / 1.2),
        "=": () => this.#zoom(1 / 1.2),
        "-": () => this.#zoom(1.2),
        "0": () => this.#move(copyOrbit(START)),
      };
      const run = keys[event.key];
      if (!run) return;
      event.preventDefault();
      // Not the note's keys too.
      event.stopPropagation();
      run();
    });
  }
}

customElements.define("lines-model", ModelView);

/* Drawing them on screen and on paper. */

/** A model to turn around, its view remembered by `key` (its code, or its file's name). */
export function modelView(model: Model, key: string, notes: string[] = []): HTMLElement {
  const view = document.createElement("lines-model") as ModelView;
  view.show(model, key, notes);
  return view;
}

/** A picture of a model for paper: light grey, with its edges in black, from where it's first seen. */
export async function modelPicture(model: Model): Promise<HTMLImageElement> {
  const engine = shared();
  if (!engine) throw new Error(t("models.noWebGL"));
  const [width, height] = [640, 400];
  const { renderer } = engine;
  const staged = stage(model, PAPER);
  const camera = new PerspectiveCamera(FOV, width / height);
  camera.add(headlight());
  staged.scene.add(camera);
  place(camera, START, staged.radius);
  renderer.setPixelRatio(2);
  renderer.setSize(width, height, false);
  renderer.render(staged.scene, camera);
  const img = document.createElement("img");
  img.className = "doc-model";
  img.alt = t("models.label", { size: sizeText(staged.size) });
  img.src = renderer.domElement.toDataURL("image/png");
  await img.decode();
  return img;
}

/** Each model's materials and look on screen follow the theme. */
new MutationObserver(() => {
  for (const view of views) view.redraw();
}).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-scheme", "data-contrast"] });
