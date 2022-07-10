export interface IPtzArgs {
  x: number;
  y: number;
  zoom: number;
}

export function isPtzArgs(o: any): o is IPtzArgs {
  return (
    typeof o === "object" &&
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    typeof o.zoom === "number" &&
    o.x >= -1 &&
    o.x <= 1 &&
    o.y >= -1 &&
    o.y <= 1 &&
    o.zoom >= 0 &&
    o.zoom <= 1
  );
}
