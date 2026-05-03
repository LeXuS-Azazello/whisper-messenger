declare module "*.js" {
  const content: string;
  export default content;
}

declare module "*.css" {
  const content: string;
  export default content;
}

declare namespace preact.JSX {
  interface HTMLAttributes<RefType extends EventTarget = EventTarget> {
    onclick?: string;
  }
}
