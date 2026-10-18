import type { ComponentType } from 'react';

export interface TrailSlot {
  /** Center and radius in scene units. */
  x: number;
  y: number;
  r: number;
}

/** An illustrated city with a trail. Stops are placed on the slots in order, near to far. */
export interface CityScene {
  city: string;
  width: number;
  height: number;
  slots: TrailSlot[];
  Art: ComponentType<{ width: number }>;
}
