import { Injectable } from '@nestjs/common';

/** Injectable randomness seam so jitter and action weighting are deterministic
 * under test. The production default is Math.random. */
@Injectable()
export class SimulationRandomSource {
  next(): number {
    return Math.random();
  }
}
