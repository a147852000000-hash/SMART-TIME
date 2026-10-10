export interface VisionInput {
  image?: unknown;
  prompt?: string;
}

export interface VisionResult {
  ok: boolean;
  available: boolean;
  message: string;
}

export async function analyzeVision(_input: VisionInput): Promise<VisionResult> {
  return {
    ok: false,
    available: false,
    message: "Vision analysis is not enabled in this local V3 surface.",
  };
}
