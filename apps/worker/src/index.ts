export type WorkerJobResult = {
  job: string;
  ok: boolean;
  message: string;
};

export type WorkerJob<TPayload = unknown> = {
  name: string;
  run(payload: TPayload): Promise<WorkerJobResult>;
};

export function createWorkerResult(job: string, message: string, ok = true): WorkerJobResult {
  return { job, ok, message };
}

export async function runWorkerJob<TPayload>(job: WorkerJob<TPayload>, payload: TPayload) {
  return job.run(payload);
}
