declare module 'd3-cloud' {
  export interface CloudBoundsPoint {
    x: number;
    y: number;
  }

  export type CloudBounds = [CloudBoundsPoint, CloudBoundsPoint] | null;

  export interface CloudWordLike {
    text: string;
    size: number;
    padding?: number;
    rotate?: number;
    x?: number;
    y?: number;
    x0?: number;
    x1?: number;
    y0?: number;
    y1?: number;
  }

  export interface CloudLayout<T extends CloudWordLike> {
    size(value: [number, number]): this;
    words(value: T[]): this;
    font(value: string | ((word: T) => string)): this;
    padding(value: number | ((word: T) => number)): this;
    rotate(value: number | ((word: T) => number)): this;
    fontSize(value: number | ((word: T) => number)): this;
    random(value: () => number): this;
    timeInterval(value: number): this;
    start(): this;
    stop(): this;
    on(type: 'word', listener: (word: T) => void): this;
    on(type: 'end', listener: (words: T[], bounds: CloudBounds) => void): this;
  }

  export default function cloud<T extends CloudWordLike = CloudWordLike>(): CloudLayout<T>;
}
