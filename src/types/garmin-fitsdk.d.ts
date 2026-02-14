declare module '@garmin/fitsdk' {
  export class Encoder {
    constructor(options?: unknown)
    writeMesg(message: Record<string, unknown>): void
    close(): Uint8Array
  }

  export const Profile: {
    MesgNum: Record<string, number>
  }

  export const Utils: {
    convertDateToDateTime(date: Date): number
  }
}

