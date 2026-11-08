/* What lines uses of WaveDrom, which comes without types. */

declare module "wavedrom" {
  /** A diagram as onml: [tag, attributes, ...children]. */
  type Onml = [string, Record<string, unknown>, ...unknown[]];
  type Skins = Record<string, unknown>;
  const wavedrom: {
    renderAny(index: number, source: object, skins: Skins, notFirstSignal?: boolean, notFirstAssign?: boolean): Onml;
    onml: { stringify(tree: Onml): string };
  };
  export default wavedrom;
}

declare module "wavedrom/skins/*.js" {
  const skins: Record<string, unknown>;
  export default skins;
}
